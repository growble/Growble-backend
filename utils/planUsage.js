const PLAN_LIMITS = require("../config/PlanLimits");
const User = require("../models/User");

const USAGE_FIELDS = ["aiReplies", "aiQualification", "followUps"];

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

module.exports = {
  hasRemainingUsage,
  recordPlanUsage,
  resetMonthlyUsage
};
