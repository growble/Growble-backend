const express = require("express");
const crypto = require("crypto");
const User = require("../models/User");
const extendPlan = require("../utils/extendPlan");
const PLAN_LIMITS = require("../config/PlanLimits");
const aiReplyPack = require("../config/AiReplyPack");

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

      if (event === "payment.captured") {
        const payment = payload.payload.payment.entity;
        const userId = payment.notes?.userId;
        const paymentId = payment.id;

        if (
          !userId ||
          typeof paymentId !== "string" ||
          !/^pay_[A-Za-z0-9]+$/.test(paymentId) ||
          payment.currency !== "INR"
        ) {
          return res.status(400).json({ message: "Missing payment notes" });
        }

        const user = await User.findOne({ _id: userId, role: "user" })
          .select("+processedPaymentIds");
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        if (
          user.lastPaymentId === paymentId ||
          user.processedPaymentIds.includes(paymentId)
        ) {
          return res.json({ status: "already processed" });
        }

        if (payment.notes?.product === "ai_reply_pack") {
          if (
            payment.notes.packId !== aiReplyPack.id ||
            payment.amount !== aiReplyPack.price * 100
          ) {
            return res.status(400).json({
              message: "AI reply pack payment amount does not match the product."
            });
          }

          const result = await User.updateOne(
            {
              _id: userId,
              role: "user",
              processedPaymentIds: { $ne: paymentId }
            },
            {
              $inc: { aiReplyCredits: aiReplyPack.aiReplies },
              $set: { lastPaymentId: paymentId },
              $addToSet: { processedPaymentIds: paymentId },
              $push: {
                billingHistory: {
                  $each: [{
                    paymentId,
                    type: "ai_reply_pack",
                    aiReplies: aiReplyPack.aiReplies,
                    amount: payment.amount / 100,
                    currency: payment.currency,
                    processedAt: payment.created_at
                      ? new Date(payment.created_at * 1000)
                      : new Date()
                  }],
                  $slice: -20
                }
              }
            }
          );

          if (!result.matchedCount) {
            if (
              await User.exists({ _id: userId, processedPaymentIds: paymentId }) ||
              await User.exists({ _id: userId, lastPaymentId: paymentId })
            ) {
              return res.json({ status: "already processed" });
            }
            return res.status(404).json({ message: "User not found" });
          }

          console.log(
            `Added ${aiReplyPack.aiReplies} AI reply credits to user ${userId}`
          );
        } else {
          if (payment.notes?.product && payment.notes.product !== "plan") {
            return res.status(400).json({ message: "Invalid payment product." });
          }
          const plan = payment.notes?.plan;
          if (!["starter", "pro", "agent"].includes(plan)) {
            return res.status(400).json({ message: "Missing payment notes" });
          }

          if (payment.amount !== PLAN_LIMITS[plan].price * 100) {
            return res.status(400).json({
              message: "Payment amount does not match the selected plan"
            });
          }

          let planExpiresAt;
          let planUpdated = false;
          for (let attempt = 0; attempt < 5; attempt += 1) {
            const currentUser = attempt === 0
              ? user
              : await User.findOne({ _id: userId, role: "user" })
                .select("+processedPaymentIds");
            if (!currentUser) {
              return res.status(404).json({ message: "User not found" });
            }
            if (
              currentUser.lastPaymentId === paymentId ||
              currentUser.processedPaymentIds.includes(paymentId)
            ) {
              return res.json({ status: "already processed" });
            }

            planExpiresAt = extendPlan(currentUser.planExpiresAt, 30);
            const result = await User.updateOne(
              {
                _id: userId,
                role: "user",
                planExpiresAt: currentUser.planExpiresAt || null,
                processedPaymentIds: { $ne: paymentId }
              },
              {
                $set: {
                  plan,
                  planExpiresAt,
                  lastPaymentId: paymentId,
                  isSuspended: false
                },
                $addToSet: { processedPaymentIds: paymentId },
                $push: {
                  billingHistory: {
                    $each: [{
                      paymentId,
                      type: "plan",
                      plan,
                      amount: payment.amount / 100,
                      currency: payment.currency,
                      processedAt: payment.created_at
                        ? new Date(payment.created_at * 1000)
                        : new Date()
                    }],
                    $slice: -20
                  }
                }
              }
            );
            if (result.matchedCount) {
              planUpdated = true;
              break;
            }
          }

          if (!planUpdated) {
            if (
              await User.exists({ _id: userId, processedPaymentIds: paymentId }) ||
              await User.exists({ _id: userId, lastPaymentId: paymentId })
            ) {
              return res.json({ status: "already processed" });
            }
            throw new Error("Could not apply plan payment after concurrent updates.");
          }

          console.log(
            `✅ User ${user.email} upgraded to ${plan} till ${planExpiresAt}`
          );
        }
      }

      res.json({ status: "ok" });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ message: "Webhook failed" });
    }
  }
);

module.exports = router;
