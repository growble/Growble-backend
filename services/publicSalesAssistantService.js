const crypto = require("crypto");
const PublicAssistantUsage = require("../models/PublicAssistantUsage");
const PLAN_LIMITS = require("../config/PlanLimits");
const aiReplyPack = require("../config/AiReplyPack");
const getOpenAIClient = require("../utils/openAIClient");

const PUBLIC_DAILY_QUESTION_LIMIT = 5;

const FEATURE_LABELS = {
  whatsapp: "WhatsApp integration",
  templates: "message templates",
  advancedAnalytics: "advanced analytics",
  facebookLeadAds: "Facebook Lead Ads",
  aiLeadQualification: "AI lead qualification",
  aiSalesAgent: "AI Sales Agent"
};

function getUtcDay(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function getNextUtcReset(now = new Date()) {
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  ));
}

function getVisitorHash(ipAddress) {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    const error = new Error("Visitor rate limiting is not configured.");
    error.code = "PUBLIC_RATE_LIMIT_NOT_CONFIGURED";
    throw error;
  }
  if (typeof ipAddress !== "string" || !ipAddress.trim()) {
    const error = new Error("Visitor address is unavailable.");
    error.code = "PUBLIC_VISITOR_ADDRESS_UNAVAILABLE";
    throw error;
  }

  return crypto
    .createHmac("sha256", secret)
    .update(ipAddress.trim())
    .digest("hex");
}

function formatPlanLimit(value) {
  return value === Infinity ? "unlimited" : value;
}

function buildPublicSalesPrompt() {
  const planFacts = Object.entries(PLAN_LIMITS)
    .map(([plan, limits]) => {
      const features = Object.entries(limits.features || {})
        .filter(([, enabled]) => enabled)
        .map(([feature]) => FEATURE_LABELS[feature] || feature)
        .join(", ") || "no paid features";
      return `${plan}: INR ${limits.price} one-time for 30 days; ` +
        `${limits.followUps} follow-ups/month; ${limits.aiReplies} AI replies/month; ` +
        `${limits.aiQualification} AI lead qualifications/month; ` +
        `${limits.teamMembers === Infinity ? "unlimited" : limits.teamMembers} team seats; ` +
        `${limits.knowledgeDocuments === Infinity ? "unlimited" : limits.knowledgeDocuments} PDF documents; ` +
        `features: ${features}.`;
    })
    .join("\n");

  return [
    "You are Growble's public product guide and pre-sales assistant.",
    "Help anonymous website visitors understand Growble and choose a suitable plan.",
    "Use only the public product facts below. Do not invent capabilities, savings, guarantees, discounts, or account details.",
    "Be friendly, concise, and practical. Keep answers under 70 words.",
    "If the visitor's needs are unclear, ask at most one short question to recommend a plan.",
    "Do not ask visitors for names, email addresses, phone numbers, passwords, payment details, or customer/lead records.",
    "Plans are one-time purchases for 30 days and do not auto-renew; never describe them as monthly subscriptions.",
    "AI Sales Agent is included only in the Agent plan. AI lead qualification is available on Pro and Agent.",
    `A top-up is ${aiReplyPack.aiReplies} additional AI replies for INR ${aiReplyPack.price}; active paid workspace owners can buy it, and it does not include AI lead qualification.`,
    "When relevant, point visitors to the plan comparison, free signup, or human contact links shown beside the chat.",
    "Those links are /pricing.html#plans, /signup.html?plan=free, and /contact.html.",
    "Public plan facts:",
    planFacts,
    "Growble organizes leads, tracks follow-ups, and helps businesses keep sales conversations moving.",
    "Growble also offers a quotation generator, GST invoice generator, and GST calculator.",
    "Human support is available at support@growble.app, Monday to Saturday, 9:00 AM to 6:00 PM IST."
  ].join("\n");
}

async function ensureUsageRecord(ipHash, day, resetAt) {
  try {
    await PublicAssistantUsage.updateOne(
      { ipHash },
      {
        $setOnInsert: {
          ipHash,
          day,
          count: 0,
          expiresAt: resetAt
        }
      },
      { upsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
  }
}

async function getPublicVisitorState(ipAddress, now = new Date()) {
  const ipHash = getVisitorHash(ipAddress);
  const day = getUtcDay(now);
  const usage = await PublicAssistantUsage.findOne({ ipHash })
    .select("day count");
  const count = usage?.day === day ? usage.count : 0;

  return {
    dailyLimit: PUBLIC_DAILY_QUESTION_LIMIT,
    questionsRemaining: Math.max(0, PUBLIC_DAILY_QUESTION_LIMIT - count),
    resetsAt: getNextUtcReset(now)
  };
}

async function reservePublicVisitorQuestion(ipAddress, now = new Date()) {
  const ipHash = getVisitorHash(ipAddress);
  const day = getUtcDay(now);
  const resetAt = getNextUtcReset(now);

  await ensureUsageRecord(ipHash, day, resetAt);
  const usage = await PublicAssistantUsage.findOneAndUpdate(
    {
      ipHash,
      $or: [
        { day: { $ne: day } },
        { day, count: { $lt: PUBLIC_DAILY_QUESTION_LIMIT } }
      ]
    },
    [
      {
        $set: {
          day,
          count: {
            $cond: [
              { $eq: ["$day", day] },
              { $add: [{ $ifNull: ["$count", 0] }, 1] },
              1
            ]
          },
          expiresAt: resetAt
        }
      }
    ],
    { new: true, projection: { count: 1, day: 1 } }
  );

  if (!usage) {
    return {
      allowed: false,
      dailyLimit: PUBLIC_DAILY_QUESTION_LIMIT,
      questionsRemaining: 0,
      day,
      resetsAt: resetAt
    };
  }
  if (!Number.isInteger(usage.count) || usage.count < 1) {
    throw new Error("Could not read the reserved public question count.");
  }

  return {
    allowed: true,
    dailyLimit: PUBLIC_DAILY_QUESTION_LIMIT,
    questionsRemaining: PUBLIC_DAILY_QUESTION_LIMIT - usage.count,
    day,
    resetsAt: resetAt
  };
}

async function releasePublicVisitorQuestion(ipAddress, day) {
  const ipHash = getVisitorHash(ipAddress);
  await PublicAssistantUsage.updateOne(
    {
      ipHash,
      day,
      count: { $gt: 0 }
    },
    {
      $inc: { count: -1 }
    }
  );
}

async function createPublicSalesAnswer(messages, client) {
  const selectedClient = client || getOpenAIClient();
  const response = await selectedClient.chat.completions.create({
    model: process.env.OPENAI_PUBLIC_MODEL ||
      process.env.OPENAI_SUPPORT_MODEL ||
      "gpt-4o-mini",
    temperature: 0.3,
    max_tokens: 300,
    messages: [
      {
        role: "system",
        content: buildPublicSalesPrompt()
      },
      ...messages
    ]
  });

  const answer = response.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error("The sales assistant returned an empty answer.");
  }
  return answer.trim().slice(0, 1400);
}

module.exports = {
  PUBLIC_DAILY_QUESTION_LIMIT,
  buildPublicSalesPrompt,
  createPublicSalesAnswer,
  getNextUtcReset,
  getPublicVisitorState,
  getVisitorHash,
  releasePublicVisitorQuestion,
  reservePublicVisitorQuestion
};
