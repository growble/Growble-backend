const PLAN_LIMITS = require("../config/PlanLimits");

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
  return used < limit;
}

async function recordPlanUsage(user, feature) {
  resetMonthlyUsage(user);
  user.automationUsage.usage[feature] =
    (user.automationUsage.usage[feature] || 0) + 1;
  await user.save();
}

module.exports = {
  hasRemainingUsage,
  recordPlanUsage,
  resetMonthlyUsage
};
