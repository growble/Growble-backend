const PLAN_LIMITS = require("../config/PlanLimits");
const User = require("../models/User");

const USAGE_FIELDS = ["leadImports", "aiReplies", "aiQualification", "followUps"];

function resetMonthlyUsage(user, now = new Date()) {
  if (!user.automationUsage) {
    user.automationUsage = {};
  }

  if (!user.automationUsage.usage) {
    user.automationUsage.usage = {};
  }

  const usage = user.automationUsage.usage;
  const resetAt = usage.resetAt ? new Date(usage.resetAt) : null;

  if (resetAt && now < resetAt) {
    return false;
  }

  for (const field of USAGE_FIELDS) {
    usage[field] = 0;
  }

  usage.resetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return true;
}

function hasRemainingUsage(user, feature) {
  const limit = PLAN_LIMITS[user.plan]?.[feature] || 0;
  const used = user.automationUsage?.usage?.[feature] || 0;
  if (used < limit) {
    return true;
  }

  return feature === "aiReplies" &&
    user.plan !== "free" &&
    (user.aiReplyCredits || 0) > 0;
}

async function recordPlanUsage(user, feature) {
  resetMonthlyUsage(user);
  const limit = PLAN_LIMITS[user.plan]?.[feature] || 0;
  const used = user.automationUsage.usage[feature] || 0;

  if (used < limit) {
    user.automationUsage.usage[feature] = used + 1;
  } else if (
    feature === "aiReplies" &&
    user.plan !== "free" &&
    (user.aiReplyCredits || 0) > 0
  ) {
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        plan: { $in: ["starter", "pro", "agent"] },
        aiReplyCredits: { $gt: 0 }
      },
      { $inc: { aiReplyCredits: -1 } },
      { new: true, projection: { aiReplyCredits: 1 } }
    );
    if (!updatedUser) {
      throw new Error("No AI reply top-up credits remain");
    }

    user.aiReplyCredits = updatedUser.aiReplyCredits;
    user.unmarkModified("aiReplyCredits");
    return;
  } else {
    throw new Error(`Monthly ${feature} limit reached`);
  }

  await user.save();
}

async function reservePlanUsage(user, feature, amount) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Usage reservation must be a positive whole number.");
  }

  if (resetMonthlyUsage(user)) {
    await user.save();
  }

  const limit = PLAN_LIMITS[user.plan]?.[feature] || 0;
  const used = user.automationUsage?.usage?.[feature] || 0;
  const resetAt = user.automationUsage.usage.resetAt;
  if (used + amount > limit) {
    const error = new Error(`Monthly ${feature} limit reached`);
    error.code = "PLAN_USAGE_LIMIT";
    throw error;
  }

  const usagePath = `automationUsage.usage.${feature}`;
  const usageConditions = [{ [usagePath]: { $lte: limit - amount } }];
  if (used === 0) {
    usageConditions.push({ [usagePath]: { $exists: false } });
  }

  const updatedUser = await User.findOneAndUpdate(
    {
      _id: user._id,
      plan: user.plan,
      "automationUsage.usage.resetAt": resetAt,
      $or: usageConditions
    },
    { $inc: { [usagePath]: amount } },
    { new: true, projection: { [usagePath]: 1 } }
  );
  if (!updatedUser) {
    const error = new Error(`Monthly ${feature} limit reached`);
    error.code = "PLAN_USAGE_LIMIT";
    throw error;
  }

  return {
    userId: user._id,
    feature,
    count: amount,
    resetAt,
    used: updatedUser.automationUsage.usage[feature],
    limit
  };
}

async function releasePlanUsage(reservation, amount) {
  if (!Number.isInteger(amount) || amount <= 0) return;

  const usagePath = `automationUsage.usage.${reservation.feature}`;
  const result = await User.updateOne(
    {
      _id: reservation.userId,
      "automationUsage.usage.resetAt": reservation.resetAt
    },
    { $inc: { [usagePath]: -amount } }
  );
  if (result.matchedCount !== 1) {
    throw new Error("Could not release unused monthly usage reservation.");
  }
}

module.exports = {
  hasRemainingUsage,
  recordPlanUsage,
  resetMonthlyUsage,
  reservePlanUsage,
  releasePlanUsage
};
