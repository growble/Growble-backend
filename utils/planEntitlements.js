const PLAN_LIMITS = require("../config/PlanLimits");

function getPlanLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

function hasPlanFeature(plan, feature) {
  return Boolean(getPlanLimits(plan).features?.[feature]);
}

module.exports = {
  getPlanLimits,
  hasPlanFeature
};
