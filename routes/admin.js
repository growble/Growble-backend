const express = require("express");
const User = require("../models/User");
const Usage = require("../models/Usage"); // or inside User
const verifyAdmin = require("../middleware/verifyAdmin");

const router = express.Router();

/**
 * GET /admin/users-usage
 */
router.get("/users-usage", verifyAdmin, async (req, res) => {
  try {
    const users = await User.find().select("name email plan isActive");

    const response = await Promise.all(
      users.map(async (u) => {
        const usage = await Usage.countDocuments({ userId: u._id });

        return {
          name: u.name,
          email: u.email,
          plan: u.plan,
          usage,
          active: u.isActive
        };
      })
    );

    res.json(response);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
