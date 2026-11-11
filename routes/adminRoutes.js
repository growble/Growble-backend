const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Lead = require("../models/Lead.js");
const PLAN_LIMITS = require("../config/PlanLimits");

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
      const customerFilter = { role: "user" };
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [
        totalUsers,
        activeUsersLast7Days,
        connectedWhatsAppUsers,
        aiConfiguredUsers,
        planStats,
        totalLeads,
        leadsByStatus,
        monthlyUsage,
        recentUsers
      ] = await Promise.all([
        User.countDocuments(customerFilter),
        User.countDocuments({
          ...customerFilter,
          lastLogin: { $gte: sevenDaysAgo }
        }),
        User.countDocuments({
          ...customerFilter,
          "whatsapp.connected": true
        }),
        User.countDocuments({
          ...customerFilter,
          aiSetupCompleted: true
        }),

        User.aggregate([
          { $match: customerFilter },
          { $group: { _id: "$plan", count: { $sum: 1 } } }
        ]),

        Lead.countDocuments(),

        Lead.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } }
        ]),

        User.aggregate([
          { $match: customerFilter },
          {
            $group: {
              _id: null,
              aiReplies: {
                $sum: {
                  $cond: [
                    { $gt: ["$automationUsage.usage.resetAt", new Date()] },
                    { $ifNull: ["$automationUsage.usage.aiReplies", 0] },
                    0
                  ]
                }
              },
              followUps: {
                $sum: {
                  $cond: [
                    { $gt: ["$automationUsage.usage.resetAt", new Date()] },
                    { $ifNull: ["$automationUsage.usage.followUps", 0] },
                    0
                  ]
                }
              }
            }
          }
        ]),

        User.find(customerFilter)
          .sort({ createdAt: -1 })
          .limit(5)
          .select("name email plan createdAt")
      ]);

      res.json({
        users: {
          total: totalUsers,
          activeLast7Days: activeUsersLast7Days,
          whatsappConnected: connectedWhatsAppUsers,
          aiConfigured: aiConfiguredUsers
        },
        leads: {
          total: totalLeads,
          byStatus: leadsByStatus
        },
        plans: planStats,
        usage: {
          aiReplies: monthlyUsage[0]?.aiReplies || 0,
          followUps: monthlyUsage[0]?.followUps || 0
        },
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
        status
      } = req.query;

      const parsedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
      const parsedLimit = Math.min(
        Math.max(Number.parseInt(limit, 10) || 10, 1),
        100
      );
      const query = { role: "user" };

      // 🔍 Search by name or email
      if (typeof search === "string" && search.trim()) {
        const searchExpression = search.trim().replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );
        query.$or = [
          { name: { $regex: searchExpression, $options: "i" } },
          { email: { $regex: searchExpression, $options: "i" } },
          { businessName: { $regex: searchExpression, $options: "i" } }
        ];
      }

      // 🎯 Filters
      if (["free", "starter", "pro", "agent"].includes(plan)) {
        query.plan = plan;
      }
      if (status === "active") query.isActive = true;
      if (status === "suspended") query.isActive = false;

      const users = await User.find(query)
        .select(
          "name email businessName plan planExpiresAt isActive lastLogin createdAt automationUsage.usage.aiReplies automationUsage.usage.followUps automationUsage.usage.resetAt whatsapp.connected aiSetupCompleted"
        )
        .sort({ createdAt: -1 })
        .skip((parsedPage - 1) * parsedLimit)
        .limit(parsedLimit);

      const total = await User.countDocuments(query);
      const usersWithUsage = users.map(user => {
        const userObject = user.toObject();
        const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;
        const usage = user.automationUsage?.usage || {};
        const usageIsCurrent = usage.resetAt && usage.resetAt > new Date();

        return {
          ...userObject,
          usage: {
            aiReplies: {
              used: usageIsCurrent ? usage.aiReplies || 0 : 0,
              limit: limits.aiReplies
            },
            followUps: {
              used: usageIsCurrent ? usage.followUps || 0 : 0,
              limit: limits.followUps
            }
          }
        };
      });

      res.json({
        users: usersWithUsage,
        pagination: {
          total,
          page: parsedPage,
          pages: Math.ceil(total / parsedLimit)
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
