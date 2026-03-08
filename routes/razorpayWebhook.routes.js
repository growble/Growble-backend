const express = require("express");
const crypto = require("crypto");
const User = require("../models/User");
const extendPlan = require("../utils/extendPlan");

const router = express.Router();

/**
 * ✅ Razorpay Webhook (Step 4B: Auto-upgrade user plan)
 * IMPORTANT: Must use RAW body
 */
router.post(
  "/razorpay",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      // 🔐 1. Verify webhook signature
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      const receivedSignature = req.headers["x-razorpay-signature"];

      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(req.body)
        .digest("hex");

      if (receivedSignature !== expectedSignature) {
        return res.status(400).json({ message: "Invalid webhook signature" });
      }

      // 📦 2. Parse payload
      const payload = JSON.parse(req.body.toString());
      const event = payload.event;

      // ✅ 3. We only care about successful payments
      if (event === "payment.captured") {
        const payment = payload.payload.payment.entity;

        const userId = payment.notes?.userId;
        const plan = payment.notes?.plan; // "pro"
        const paymentId = payment.id;

        if (!userId || !plan) {
          return res.status(400).json({ message: "Missing payment notes" });
        }

        // 👤 4. Find user
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // 🔁 5. Prevent duplicate processing
        if (user.lastPaymentId === paymentId) {
          return res.json({ status: "already processed" });
        }

        user.lastPaymentId = paymentId;

        // ⏳ 6. Decide plan duration
        let daysToAdd = 0;

        if (plan === "pro") {
          daysToAdd = 30;
          user.plan = "pro";
        }

        // 📅 7. Extend plan expiry
        user.planExpiresAt = extendPlan(user.planExpiresAt, daysToAdd);

        // 🔓 8. Unsuspend user (if suspended)
        user.isSuspended = false;

        await user.save();

        console.log(
          `✅ User ${user.email} upgraded to ${user.plan} till ${user.planExpiresAt}`
        );
      }

      // ✅ 9. Acknowledge webhook
      res.json({ status: "ok" });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ message: "Webhook failed" });
    }
  }
);

module.exports = router;
