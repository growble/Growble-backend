const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const metaService = require("../services/meta.service");

router.get("/status", authMiddleware, (req, res) => {
  res.json({
    success: true,
    connected: req.user.whatsapp.connected,
    whatsapp: req.user.whatsapp
  });
});

router.post("/exchange-code", authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code is required."
      });
    }

    const result = await metaService.connectCustomer(
      code,
      req.user._id
    );

    return res.json({
      success: true,
      message: "WhatsApp connected successfully.",
      data: result
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message
    });

  }
});

module.exports = router;