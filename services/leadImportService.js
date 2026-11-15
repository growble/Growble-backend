const readXlsxFile = require("read-excel-file/node");

const MAX_IMPORT_ROWS = 15000;
const HEADER_FIELDS = {
  name: ["name", "fullname", "leadname", "contactname"],
  phone: ["phone", "phonenumber", "mobile", "mobilenumber", "telephone", "whatsapp"],
  email: ["email", "emailaddress"],
  status: ["status", "leadstatus", "leadtype", "type"],
  notes: ["note", "notes", "description"],
  source: ["source", "leadsource"],
  nextFollowUpAt: ["followupdate", "nextfollowup", "nextfollowupat"]
};
const VALID_STATUSES = new Set(["new", "contacted", "interested", "closed", "lost"]);
const VALID_SOURCES = new Set(["website", "whatsapp", "facebook", "manual", "other"]);
const STATUS_ALIASES = new Map([
  ["open", "new"],
  ["uncontacted", "new"],
  ["new_lead", "new"],
  ["contact", "contacted"],
  ["called", "contacted"],
  ["reached_out", "contacted"],
  ["contacted_lead", "contacted"],
  ["qualified", "interested"],
  ["won", "closed"],
  ["closed_won", "closed"],
  ["closed_lost", "lost"]
]);

function importError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function splitCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"' && value.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some(cell => String(cell).trim())) rows.push(row);
      row = [];
      value = "";
      if (rows.length > MAX_IMPORT_ROWS + 1) {
        throw importError(`A file can contain at most ${MAX_IMPORT_ROWS} lead rows.`, 413);
      }
    } else {
      value += character;
    }
  }

  if (quoted) throw importError("The CSV file contains an unclosed quoted field.");
  row.push(value);
  if (row.some(cell => String(cell).trim())) rows.push(row);
  if (rows.length > MAX_IMPORT_ROWS + 1) {
    throw importError(`A file can contain at most ${MAX_IMPORT_ROWS} lead rows.`, 413);
  }
  return rows;
}

function headerName(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(headerName);
  if (!headers.some(header => HEADER_FIELDS.name.includes(header)) ||
      !headers.some(header => HEADER_FIELDS.phone.includes(header))) {
    throw importError("Include name and phone columns in the first row.");
  }

  return rows.slice(1).map(row => {
    const record = {};
    headers.forEach((header, index) => {
      if (row[index] !== undefined) record[header] = row[index];
    });
    return record;
  });
}

function getField(record, field) {
  const matchingHeader = HEADER_FIELDS[field].find(header =>
    Object.prototype.hasOwnProperty.call(record, header)
  );
  return matchingHeader ? record[matchingHeader] : "";
}

function normalizeRecord(record) {
  const normalized = Object.create(null);
  for (const [key, value] of Object.entries(record)) {
    normalized[headerName(key)] = value;
  }
  return normalized;
}

function text(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function normalizeStatus(value) {
  const rawStatus = text(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (!rawStatus) return { status: "new", defaulted: false };
  if (VALID_STATUSES.has(rawStatus)) return { status: rawStatus, defaulted: false };

  const status = STATUS_ALIASES.get(rawStatus);
  return status
    ? { status, defaulted: false }
    : { status: "new", defaulted: true };
}

function normalizeLead(record, rowNumber) {
  record = normalizeRecord(record);
  const name = text(getField(record, "name"));
  const phone = text(getField(record, "phone"));
  const email = text(getField(record, "email")).toLowerCase();
  const notes = text(getField(record, "notes"));
  const sourceValue = text(getField(record, "source")).toLowerCase();
  const followUpValue = getField(record, "nextFollowUpAt");
  const statusResult = normalizeStatus(getField(record, "status"));
  const errors = [];

  if (!name) errors.push("Name is required.");
  if (!phone) errors.push("Phone is required.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Email is invalid.");
  }
  if (name.length > 200) errors.push("Name must be 200 characters or fewer.");
  if (phone.length > 50) errors.push("Phone must be 50 characters or fewer.");

  let nextFollowUpAt = null;
  if (text(followUpValue)) {
    nextFollowUpAt = new Date(followUpValue);
    if (Number.isNaN(nextFollowUpAt.getTime())) {
      errors.push("Follow-up date is invalid.");
    }
  }

  const source = VALID_SOURCES.has(sourceValue) ? sourceValue : "other";
  return {
    rowNumber,
    errors,
    statusDefaulted: statusResult.defaulted,
    lead: errors.length ? null : {
      name,
      phone,
      email: email || undefined,
      notes: notes || undefined,
      source,
      status: statusResult.status,
      nextFollowUpAt
    }
  };
}

async function getRawRecords(file) {
  const extension = file.originalname.toLowerCase().split(".").pop();
  if (extension === "json") {
    let data;
    try {
      data = JSON.parse(file.buffer.toString("utf8").replace(/^\uFEFF/, ""));
    } catch (error) {
      throw importError("The JSON file is not valid JSON.");
    }
    const records = Array.isArray(data) ? data : data?.leads;
    if (!Array.isArray(records)) {
      throw importError("JSON must contain an array of leads or a leads array property.");
    }
    if (records.length > MAX_IMPORT_ROWS) {
      throw importError(`A file can contain at most ${MAX_IMPORT_ROWS} lead rows.`, 413);
    }
    return records.map((record, index) => ({
      record: record && typeof record === "object" && !Array.isArray(record) ? record : {},
      rowNumber: index + 1
    }));
  }

  let rows;
  if (extension === "csv") {
    rows = rowsToObjects(splitCsv(file.buffer.toString("utf8")));
  } else if (extension === "xlsx") {
    try {
      const sheets = await readXlsxFile(file.buffer);
      const worksheetRows = sheets[0]?.data || sheets;
      if (worksheetRows.length > MAX_IMPORT_ROWS + 1) {
        throw importError(`A file can contain at most ${MAX_IMPORT_ROWS} lead rows.`, 413);
      }
      rows = rowsToObjects(worksheetRows);
    } catch (error) {
      if (error.statusCode) throw error;
      throw importError("The XLSX file could not be read.");
    }
  } else {
    throw importError("Upload a CSV, XLSX, or JSON file.");
  }

  return rows.map((record, index) => ({ record, rowNumber: index + 2 }));
}

async function parseLeadUpload(file) {
  const records = await getRawRecords(file);
  if (!records.length) throw importError("The file does not contain any lead rows.");
  return records.map(({ record, rowNumber }) => normalizeLead(record, rowNumber));
}

module.exports = {
  MAX_IMPORT_ROWS,
  parseLeadUpload,
  normalizeStatus,
  splitCsv
};
