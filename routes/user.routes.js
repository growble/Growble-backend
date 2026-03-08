const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const User = require("../models/User");

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("name email plan planActivatedAt");
    res.json({
  success: true,
  user,
  planExpired: req.planExpired || false,
  planExpiringSoon: req.planExpiringSoon || null
});
  } catch (err) {
    res.status(500).json({ success: false, message: "server error" });
  }
});

module.exports = router;
