const test = require("node:test");
const assert = require("node:assert/strict");
const PublicAssistantUsage = require("../models/PublicAssistantUsage");
const { normalizeSupportMessages } = require("../services/supportAssistantService");
const {
  PUBLIC_DAILY_QUESTION_LIMIT,
  buildPublicSalesPrompt,
  createPublicSalesAnswer,
  getNextUtcReset,
  getPublicVisitorState,
  getVisitorHash,
  reservePublicVisitorQuestion
} = require("../services/publicSalesAssistantService");

test("public sales guidance uses one-time plan facts and conversion links", () => {
  const prompt = buildPublicSalesPrompt();

  assert.match(prompt, /one-time for 30 days/);
  assert.match(prompt, /AI Sales Agent is included only in the Agent plan/);
  assert.match(prompt, /\/pricing\.html#plans/);
  assert.match(prompt, /Do not ask visitors for names, email addresses, phone numbers/);
});

test("visitor rate-limit keys are HMACed and never retain the raw address", () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "unit-test-secret";
  try {
    const hash = getVisitorHash("203.0.113.42");
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.notEqual(hash, "203.0.113.42");
  } finally {
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  }
});

test("public visitor question reservation is atomic and daily-capped", async () => {
  const originalUpdateOne = PublicAssistantUsage.updateOne;
  const originalFindOneAndUpdate = PublicAssistantUsage.findOneAndUpdate;
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "unit-test-secret";
  const now = new Date("2026-11-14T12:00:00.000Z");
  let inserted;
  let filter;
  let update;

  PublicAssistantUsage.updateOne = async (query, operation, options) => {
    inserted = { query, operation, options };
    return { upsertedCount: 1 };
  };
  PublicAssistantUsage.findOneAndUpdate = async (receivedFilter, receivedUpdate) => {
    filter = receivedFilter;
    update = receivedUpdate;
    return { count: 1, day: "2026-11-14" };
  };

  try {
    const reservation = await reservePublicVisitorQuestion(
      "203.0.113.42",
      now
    );
    assert.equal(reservation.allowed, true);
    assert.equal(
      reservation.questionsRemaining,
      PUBLIC_DAILY_QUESTION_LIMIT - 1
    );
    assert.equal(reservation.resetsAt.toISOString(), getNextUtcReset(now).toISOString());
    assert.equal(filter.$or[1].count.$lt, PUBLIC_DAILY_QUESTION_LIMIT);
    assert.equal(update[0].$set.count.$cond[2], 1);
    assert.equal(inserted.options.upsert, true);
    assert.notEqual(inserted.operation.$setOnInsert.ipHash, "203.0.113.42");

    PublicAssistantUsage.findOneAndUpdate = async () => null;
    const denied = await reservePublicVisitorQuestion(
      "203.0.113.42",
      now
    );
    assert.equal(denied.allowed, false);
    assert.equal(denied.questionsRemaining, 0);
  } finally {
    PublicAssistantUsage.updateOne = originalUpdateOne;
    PublicAssistantUsage.findOneAndUpdate = originalFindOneAndUpdate;
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  }
});

test("public chat state reveals only remaining visitor questions", async () => {
  const originalFindOne = PublicAssistantUsage.findOne;
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "unit-test-secret";
  const now = new Date("2026-11-14T12:00:00.000Z");
  PublicAssistantUsage.findOne = () => ({
    select: async () => ({ day: "2026-11-14", count: 2 })
  });

  try {
    const state = await getPublicVisitorState("203.0.113.42", now);
    assert.equal(state.questionsRemaining, 3);
    assert.equal(state.dailyLimit, 5);
    assert.equal(state.resetsAt.toISOString(), getNextUtcReset(now).toISOString());
  } finally {
    PublicAssistantUsage.findOne = originalFindOne;
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  }
});

test("sales assistant answers use public product context only", async () => {
  let request;
  const client = {
    chat: {
      completions: {
        create: async options => {
          request = options;
          return {
            choices: [{ message: { content: "Try Free to organize your leads, then compare plans as your needs grow." } }]
          };
        }
      }
    }
  };
  const messages = normalizeSupportMessages([
    { role: "user", content: "Which plan should I start with?" }
  ]);
  const answer = await createPublicSalesAnswer(messages, client);

  assert.match(answer, /Try Free/);
  assert.equal(request.model, process.env.OPENAI_PUBLIC_MODEL ||
    process.env.OPENAI_SUPPORT_MODEL || "gpt-4o-mini");
  assert.match(request.messages[0].content, /Public plan facts/);
  assert.doesNotMatch(request.messages[0].content, /workspace summary|billing history/);
});
