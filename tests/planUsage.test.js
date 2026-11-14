const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../models/User");
const {
  hasRemainingUsage,
  recordPlanUsage
} = require("../utils/planUsage");

function createUser(overrides = {}) {
  return {
    plan: "starter",
    aiReplyCredits: 0,
    automationUsage: {
      usage: {
        aiReplies: 0,
        aiQualification: 0,
        followUps: 0,
        resetAt: new Date(Date.now() + 86400000)
      }
    },
    async save() {},
    unmarkModified() {},
    ...overrides
  };
}

test("monthly AI reply allowance is consumed before purchased credits", async () => {
  const user = createUser({
    aiReplyCredits: 2,
    automationUsage: {
      usage: {
        aiReplies: 99,
        aiQualification: 0,
        followUps: 0,
        resetAt: new Date(Date.now() + 86400000)
      }
    }
  });

  assert.equal(hasRemainingUsage(user, "aiReplies"), true);
  await recordPlanUsage(user, "aiReplies");
  assert.equal(user.automationUsage.usage.aiReplies, 100);
  assert.equal(user.aiReplyCredits, 2);

  const originalFindOneAndUpdate = User.findOneAndUpdate;
  User.findOneAndUpdate = async (filter, update) => {
    assert.equal(filter.aiReplyCredits.$gt, 0);
    assert.equal(update.$inc.aiReplyCredits, -1);
    return { aiReplyCredits: user.aiReplyCredits - 1 };
  };
  try {
    await recordPlanUsage(user, "aiReplies");
  } finally {
    User.findOneAndUpdate = originalFindOneAndUpdate;
  }
  assert.equal(user.automationUsage.usage.aiReplies, 100);
  assert.equal(user.aiReplyCredits, 1);
});

test("monthly reset preserves purchased credits", async () => {
  const user = createUser({
    aiReplyCredits: 3,
    automationUsage: {
      usage: {
        aiReplies: 100,
        aiQualification: 0,
        followUps: 0,
        resetAt: new Date(Date.now() - 86400000)
      }
    }
  });

  await recordPlanUsage(user, "aiReplies");
  assert.equal(user.automationUsage.usage.aiReplies, 1);
  assert.equal(user.aiReplyCredits, 3);
});

test("Free plans cannot use paid AI reply top-up credits", async () => {
  const user = createUser({ plan: "free", aiReplyCredits: 5 });

  assert.equal(hasRemainingUsage(user, "aiReplies"), false);
  await assert.rejects(recordPlanUsage(user, "aiReplies"), /limit reached/);
  assert.equal(user.aiReplyCredits, 5);
});

test("atomic top-up consumption cannot spend a credit removed by a concurrent request", async () => {
  const user = createUser({
    aiReplyCredits: 1,
    automationUsage: {
      usage: {
        aiReplies: 100,
        aiQualification: 0,
        followUps: 0,
        resetAt: new Date(Date.now() + 86400000)
      }
    }
  });
  const originalFindOneAndUpdate = User.findOneAndUpdate;
  User.findOneAndUpdate = async filter => {
    assert.equal(filter.aiReplyCredits.$gt, 0);
    return null;
  };

  try {
    await assert.rejects(
      recordPlanUsage(user, "aiReplies"),
      /No AI reply top-up credits remain/
    );
  } finally {
    User.findOneAndUpdate = originalFindOneAndUpdate;
  }

  assert.equal(user.aiReplyCredits, 1);
});
