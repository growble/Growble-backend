const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Lead = require("../models/Lead");
const Usage = require("../models/Usage");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

/**
 * GET /api/admin/stats
 */
router.get(
  "/stats",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      });
      const [
        totalUsers,
        activeUsers,
        totalLeads,
        leadsByStatus,
        totalAutomations,
        planDistribution,
        recentUsers
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ lastLogin: { $gte: sevenDaysAgo } }),
        Lead.countDocuments(),

        Lead.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } }
        ]),

        Usage.aggregate([
          { $group: { _id: null, total: { $sum: "$automationsUsed" } } }
        ]),

        User.aggregate([
          { $group: { _id: "$plan", count: { $sum: 1 } } }
        ]),

        User.find()
          .sort({ createdAt: -1 })
          .limit(5)
          .select("name email plan createdAt")
      ]);
console.log("Seven days ago:", sevenDaysAgo);
console.log("Active users count:", activeUsers);
      res.json({
        users: {
          total: totalUsers,
          activeLast7Days: activeUsers
        },
        leads: {
          total: totalLeads,
          byStatus: leadsByStatus
        },
        automations: {
          total: totalAutomations[0]?.total || 0
        },
        plans: planDistribution,
        recentUsers
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to load admin stats" });
    }
  }
);

module.exports = router;
