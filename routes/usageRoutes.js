const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const PLAN_LIMITS = require("../config/PlanLimits");
const { resetMonthlyUsage } = require("../utils/planUsage");

const router = express.Router();

/**
 * @route   GET /api/usage
 * @desc    Get current user's automation usage stats
 * @access  Private
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const usageReset = resetMonthlyUsage(user);

    if (usageReset) {
      await user.save();
    }

    const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;
    const limit = limits.followUps;
    const used = user.automationUsage.usage.followUps;

    res.status(200).json({
      plan: user.plan,
      used,
      limit,
      remaining: Math.max(limit - used, 0),
      resetAt: user.automationUsage.usage.resetAt
    });
  } catch (error) {
    console.error("Usage stats error:", error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

module.exports = router;
