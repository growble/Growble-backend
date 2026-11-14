const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseQualification,
  qualifyLeadForWorkspace
} = require("../services/leadQualificationService");

test("AI qualification output is validated and normalized", () => {
  assert.deepEqual(
    parseQualification(JSON.stringify({
      score: 82.4,
      temperature: "hot",
      sentiment: "positive",
      summary: "Strong purchase intent.",
      nextAction: "Call today."
    })),
    {
      aiScore: 82,
      aiLeadTemperature: "hot",
      aiSentiment: "positive",
      aiSummary: "Strong purchase intent.",
      aiNextAction: "Call today."
    }
  );
});

test("invalid AI qualification data is rejected", () => {
  assert.throws(
    () => parseQualification(JSON.stringify({
      score: 120,
      temperature: "hot",
      sentiment: "positive",
      summary: "Strong.",
      nextAction: "Call."
    })),
    /incomplete qualification data/
  );
});

test("Free plans keep their current non-AI qualification behavior", async () => {
  const workspaceOwner = {
    plan: "free",
    automationUsage: {
      usage: {
        aiReplies: 0,
        aiQualification: 0,
        followUps: 0,
        resetAt: new Date(Date.now() + 86400000)
      }
    },
    async save() {}
  };
  const lead = {};

  const result = await qualifyLeadForWorkspace(lead, workspaceOwner);

  assert.equal(result.status, "not_included");
  assert.deepEqual(lead, {});
});
