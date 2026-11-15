const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../models/User");
const {
  hasRemainingUsage,
  recordPlanUsage,
  reservePlanUsage,
  releasePlanUsage
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
        leadImports: 31,
        aiReplies: 100,
        aiQualification: 0,
        followUps: 0,
        resetAt: new Date(Date.now() - 86400000)
      }
    }
  });

  await recordPlanUsage(user, "aiReplies");
  assert.equal(user.automationUsage.usage.leadImports, 0);
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

test("lead import usage is reserved atomically and unused slots can be released", async () => {
  const user = createUser({
    _id: "workspace-owner",
    automationUsage: {
      usage: {
        leadImports: 10,
        aiReplies: 0,
        aiQualification: 0,
        followUps: 0,
        resetAt: new Date(Date.now() + 86400000)
      }
    }
  });
  const originalFindOneAndUpdate = User.findOneAndUpdate;
  const originalUpdateOne = User.updateOne;
  let filter;
  let update;
  User.findOneAndUpdate = async (query, changes) => {
    filter = query;
    update = changes;
    return { automationUsage: { usage: { leadImports: 13 } } };
  };
  User.updateOne = async (query, changes) => {
    assert.equal(query._id, user._id);
    assert.equal(changes.$inc["automationUsage.usage.leadImports"], -1);
    return { matchedCount: 1 };
  };

  try {
    const reservation = await reservePlanUsage(user, "leadImports", 3);
    assert.equal(reservation.used, 13);
    assert.equal(update.$inc["automationUsage.usage.leadImports"], 3);
    assert.equal(filter.plan, "starter");
    await releasePlanUsage(reservation, 1);
  } finally {
    User.findOneAndUpdate = originalFindOneAndUpdate;
    User.updateOne = originalUpdateOne;
  }
});

test("lead import usage cannot reserve more than the plan's remaining quota", async () => {
  const user = createUser({
    automationUsage: {
      usage: {
        leadImports: 999,
        aiReplies: 0,
        aiQualification: 0,
        followUps: 0,
        resetAt: new Date(Date.now() + 86400000)
      }
    }
  });
  await assert.rejects(
    reservePlanUsage(user, "leadImports", 2),
    error => error.code === "PLAN_USAGE_LIMIT"
  );
});
