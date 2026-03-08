const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Lead = require("../models/Lead");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

/**
 * 🔹 GET ADMIN DASHBOARD STATS
 * GET /api/admin/stats
 */
router.get(
  "/stats",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const [
        totalUsers,
        activeUsers,
        planStats,
        totalLeads,
        leadsByStatus,
        recentUsers
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),

        User.aggregate([
          { $group: { _id: "$plan", count: { $sum: 1 } } }
        ]),

        Lead.countDocuments(),

        Lead.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } }
        ]),

        User.find()
          .sort({ createdAt: -1 })
          .limit(5)
          .select("name email plan createdAt")
      ]);

      res.json({
        users: {
          total: totalUsers,
          active: activeUsers
        },
        leads: {
          total: totalLeads,
          byStatus: leadsByStatus
        },
        plans: planStats,
        recentUsers
      });
    } catch (err) {
      console.error("Admin stats error:", err);
      res.status(500).json({
        message: "Failed to load admin stats"
      });
    }
  }
);
/**
 * GET /api/admin/users
 * List all users (Admin only)
 */
router.get(
  "/users",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        search = "",
        plan,
        role,
        status
      } = req.query;

      const query = {};

      // 🔍 Search by name or email
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } }
        ];
      }

      // 🎯 Filters
      if (plan) query.plan = plan;
      if (role) query.role = role;
      if (status === "active") query.isActive = true;
      if (status === "suspended") query.isActive = false;

      const users = await User.find(query)
        .select(
          "name email plan role isActive automationUsage.count createdAt"
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit));

      const total = await User.countDocuments(query);

      res.json({
        users,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      console.error("List users error:", err);
      res.status(500).json({
        message: "Failed to fetch users"
      });
    }
  }
);
/**
 * PATCH /api/admin/users/:id/suspend
 * Suspend / Unsuspend user
 */
router.patch(
  "/users/:id/suspend",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { isActive } = req.body;

      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          message: "isActive must be true or false"
        });
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { isActive },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({
          message: "User not found"
        });
      }

      res.json({
        success: true,
        message: isActive
          ? "User activated successfully"
          : "User suspended successfully",
        user: {
          id: user._id,
          isActive: user.isActive
        }
      });
    } catch (err) {
      console.error("Suspend user error:", err);
      res.status(500).json({
        message: "Failed to update user status"
      });
    }
  }
);

module.exports = router;
