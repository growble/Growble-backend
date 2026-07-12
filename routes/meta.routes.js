const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

// Temporary route
router.get("/status", authMiddleware, async (req, res) => {
  res.json({
    success: true,
    message: "Meta routes working successfully.",
    userId: req.user.id
  });
});

module.exports = router;