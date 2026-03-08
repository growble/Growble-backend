const express = require("express");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Plan limits (same as scheduler)
const PLAN_LIMITS = {
  free: 0,
  starter: 50,
  pro: Infinity
};

/**
 * @route   GET /api/usage
 * @desc    Get current user's automation usage stats
 * @access  Private
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const limit = PLAN_LIMITS[user.plan];
    const used = user.automationUsage?.count || 0;

    res.status(200).json({
      plan: user.plan,
      used,
      limit,
      remaining: limit === Infinity ? Infinity : Math.max(limit - used, 0),
      resetAt: user.automationUsage?.resetAt
    });
  } catch (error) {
    console.error("Usage stats error:", error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

module.exports = router;
