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

router.post("/exchange-code", authMiddleware, async (req, res) => {

    const { code } = req.body;

    console.log("Received authorization code:", code);

    // We'll implement the Meta token exchange next.
    return res.json({
        success: true,
        message: "Authorization code received.",
        code
    });

});
module.exports = router;