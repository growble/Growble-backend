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
    status: "qualified",
    nextFollowUpAt: null,
    dealValue: 0,
    expectedCloseDate: null,
    campaign: ""
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
        { name: "Taylor", phone: "5551112233", status: "Proposal" },
        { name: "Riley", phone: "5552223344", status: "Closed Won" },
        { name: "Drew", phone: "5553334455", status: "Closed Lost" },
        { name: "Avery", phone: "5554445566", status: "Closed" },
        { name: "Jordan", phone: "5555556677", status: "Lost" },
        { name: "Missing Phone" }
      ]
    })
  ));

  assert.equal(rows[0].lead.status, "new");
  assert.equal(rows[0].statusDefaulted, true);
  assert.equal(rows[1].lead.status, "qualified");
  assert.equal(rows[2].lead.status, "proposal");
  assert.equal(rows[3].lead.status, "closed_won");
  assert.equal(rows[4].lead.status, "closed_lost");
  assert.equal(rows[5].lead.status, "closed_won");
  assert.equal(rows[6].lead.status, "closed_lost");
  assert.deepEqual(rows[7].errors, ["Phone is required."]);
});

test("CSV import reads a next follow-up date column", async () => {
  const rows = await parseLeadUpload(upload(
    "leads.csv",
    "Name,Phone,Next Follow-up Date\nAvery,5551234567,2030-05-06"
  ));

  assert.equal(rows[0].errors.length, 0);
  assert.equal(rows[0].lead.nextFollowUpAt.toISOString(), "2030-05-06T00:00:00.000Z");
});

test("CSV import extracts supported fields and ignores unrelated columns", async () => {
  const rows = await parseLeadUpload(upload(
    "leads.csv",
    "Name,Phone,Email,Deal Amount,Expected Close Date,Campaign,Company Size,Internal Rating\n" +
      "Avery,5551234567,avery@example.com,\"₹1,25,000\",2030-05-06,Spring Sale,50,Confidential"
  ));

  assert.equal(rows[0].errors.length, 0);
  assert.equal(rows[0].lead.email, "avery@example.com");
  assert.equal(rows[0].lead.dealValue, 125000);
  assert.equal(rows[0].lead.expectedCloseDate.toISOString(), "2030-05-06T00:00:00.000Z");
  assert.equal(rows[0].lead.campaign, "Spring Sale");
  assert.equal(Object.hasOwn(rows[0].lead, "companySize"), false);
  assert.equal(Object.hasOwn(rows[0].lead, "internalRating"), false);
});

test("JSON import ignores unsupported properties", async () => {
  const rows = await parseLeadUpload(upload(
    "leads.json",
    JSON.stringify([{
      name: "Avery",
      phone: "5551234567",
      status: "qualified",
      internalRating: "Confidential",
      arbitraryData: { retained: true }
    }])
  ));

  assert.equal(rows[0].errors.length, 0);
  assert.deepEqual(Object.keys(rows[0].lead).sort(), [
    "campaign",
    "dealValue",
    "email",
    "name",
    "nextFollowUpAt",
    "notes",
    "phone",
    "source",
    "status",
    "expectedCloseDate"
  ].sort());
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
