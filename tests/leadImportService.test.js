const test = require("node:test");
const assert = require("node:assert/strict");
const { parseLeadUpload } = require("../services/leadImportService");

function upload(originalname, contents) {
  return {
    originalname,
    buffer: Buffer.from(contents)
  };
}

test("CSV import reads aliases and preserves an explicitly supplied lead status", async () => {
  const rows = await parseLeadUpload(upload(
    "leads.csv",
    "Full Name,Mobile Number,Lead Type,Email,Notes\r\n" +
      '"Avery, Smith",+15551234567,Contacted,avery@example.com,Asked for details\r\n' +
      "Jordan,+15557654321,,,"
  ));

  assert.deepEqual(rows[0].lead, {
    name: "Avery, Smith",
    phone: "+15551234567",
    email: "avery@example.com",
    notes: "Asked for details",
    source: "other",
    status: "contacted",
    nextFollowUpAt: null
  });
  assert.equal(rows[0].statusDefaulted, false);
  assert.equal(rows[1].lead.status, "new");
  assert.equal(rows[1].errors.length, 0);
});

test("JSON import accepts canonical fields and defaults unknown statuses to new", async () => {
  const rows = await parseLeadUpload(upload(
    "leads.json",
    JSON.stringify({
      leads: [
        { name: "Casey", phone: "5551234567", status: "pending" },
        { name: "Morgan", phone: "5557654321", status: "Interested" },
        { name: "Missing Phone" }
      ]
    })
  ));

  assert.equal(rows[0].lead.status, "new");
  assert.equal(rows[0].statusDefaulted, true);
  assert.equal(rows[1].lead.status, "interested");
  assert.deepEqual(rows[2].errors, ["Phone is required."]);
});

test("CSV import reads a next follow-up date column", async () => {
  const rows = await parseLeadUpload(upload(
    "leads.csv",
    "Name,Phone,Next Follow-up Date\nAvery,5551234567,2030-05-06"
  ));

  assert.equal(rows[0].errors.length, 0);
  assert.equal(rows[0].lead.nextFollowUpAt.toISOString(), "2030-05-06T00:00:00.000Z");
});

test("CSV import preserves the calendar day in day-first and month-first dates", async () => {
  const rows = await parseLeadUpload(upload(
    "leads.csv",
    "Name,Phone,Next Follow-up Date\n" +
      "Avery,5551234567,15/11/2030\n" +
      "Jordan,5557654321,11/15/2030"
  ));

  assert.equal(rows[0].lead.nextFollowUpAt.toISOString(), "2030-11-15T00:00:00.000Z");
  assert.equal(rows[1].lead.nextFollowUpAt.toISOString(), "2030-11-15T00:00:00.000Z");
});

test("CSV import rejects files without required name and phone columns", async () => {
  await assert.rejects(
    parseLeadUpload(upload("leads.csv", "Name,Email\nAvery,avery@example.com")),
    /Include name and phone columns/
  );
});
