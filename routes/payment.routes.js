const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const auth = require("../middleware/authMiddleware");
const PLAN_LIMITS = require("../config/PlanLimits");
const aiReplyPack = require("../config/AiReplyPack");
const User = require("../models/User");

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    return null;
  }

  return {
    client: new Razorpay({ key_id: keyId, key_secret: keySecret }),
    keyId
  };
}

/**
 * ✅ CREATE ORDER
 * Plan upgrade happens ONLY via webhook
 */
router.post("/create-order", auth, async (req, res) => {
  try {
    if (
      req.user.role !== "user" ||
      String(req.user._id) !== String(req.workspaceOwner._id)
    ) {
      return res.status(403).json({ error: "Only the workspace owner can manage billing" });
    }

    // 🔐 1. userId from auth middleware
    const userId = String(req.user._id);

    // 🔖 2. Plan & amount (backend controlled)
    const { plan } = req.body;
    if (!["starter", "pro", "agent"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const razorpayConfig = getRazorpayClient();
    if (!razorpayConfig) {
      console.error("Create order unavailable: Razorpay API keys are not configured.");
      return res.status(503).json({
        error: "Payments are temporarily unavailable. Please contact support."
      });
    }

    const amount = PLAN_LIMITS[plan].price;

    // 🧾 3. Create Razorpay order with NOTES
    const order = await razorpayConfig.client.orders.create({
      amount: amount * 100, // paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId: userId,
        product: "plan",
        plan: plan,
      },
    });

    // 📤 4. Respond
    res.json({
      orderId: order.id,
      amount: order.amount,
      keyId: razorpayConfig.keyId,
    });
  } catch (error) {
    const providerError = error?.error;
    const statusCode = error?.statusCode;
    const errorCode = providerError?.code || error?.code;
    const description = providerError?.description || error?.message;
    console.error("Create order error:", {
      statusCode,
      code: errorCode,
      description
    });

    if (statusCode === 401 || statusCode === 403) {
      return res.status(503).json({
        error: "Payment gateway credentials are invalid or inactive. Please contact support."
      });
    }
    if (statusCode && statusCode < 500) {
      return res.status(502).json({
        error: "Razorpay could not create the payment order. Please try again or contact support."
      });
    }
    res.status(502).json({
      error: "Payment service is temporarily unavailable. Please try again shortly."
    });
  }
});

router.post("/create-ai-reply-order", auth, async (req, res) => {
  try {
    if (
      req.user.role !== "user" ||
      String(req.user._id) !== String(req.workspaceOwner._id)
    ) {
      return res.status(403).json({
        error: "Only the workspace owner can purchase AI reply credits."
      });
    }

    if (
      !["starter", "pro", "agent"].includes(req.workspaceOwner.plan) ||
      !req.workspaceOwner.planExpiresAt ||
      req.workspaceOwner.planExpiresAt <= new Date()
    ) {
      return res.status(403).json({
        error: "AI reply top-ups are available to active paid workspaces only."
      });
    }

    const razorpayConfig = getRazorpayClient();
    if (!razorpayConfig) {
      console.error("Create AI reply order unavailable: Razorpay API keys are not configured.");
      return res.status(503).json({
        error: "Payments are temporarily unavailable. Please contact support."
      });
    }

    const order = await razorpayConfig.client.orders.create({
      amount: aiReplyPack.price * 100,
      currency: "INR",
      receipt: `ai_replies_${Date.now()}`,
      notes: {
        userId: String(req.workspaceOwner._id),
        product: "ai_reply_pack",
        packId: aiReplyPack.id
      }
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      keyId: razorpayConfig.keyId,
      product: {
        id: aiReplyPack.id,
        aiReplies: aiReplyPack.aiReplies,
        price: aiReplyPack.price
      }
    });
  } catch (error) {
    const providerError = error?.error;
    const statusCode = error?.statusCode;
    const errorCode = providerError?.code || error?.code;
    const description = providerError?.description || error?.message;
    console.error("Create AI reply order error:", {
      statusCode,
      code: errorCode,
      description
    });

    if (statusCode === 401 || statusCode === 403) {
      return res.status(503).json({
        error: "Payment gateway credentials are invalid or inactive. Please contact support."
      });
    }
    if (statusCode && statusCode < 500) {
      return res.status(502).json({
        error: "Razorpay could not create the payment order. Please try again or contact support."
      });
    }
    res.status(502).json({
      error: "Payment service is temporarily unavailable. Please try again shortly."
    });
  }
});

router.get("/history", auth, async (req, res) => {
  if (
    req.user.role !== "user" ||
    String(req.user._id) !== String(req.workspaceOwner._id)
  ) {
    return res.status(403).json({
      message: "Only the workspace owner can view billing history."
    });
  }

  try {
    const owner = await User.findById(req.workspaceOwner._id)
      .select("plan planExpiresAt billingHistory");
    if (!owner) {
      return res.status(404).json({ message: "Workspace owner not found." });
    }

    res.json({
      plan: owner.plan,
      planExpiresAt: owner.planExpiresAt,
      transactions: [...owner.billingHistory]
        .sort((left, right) => right.processedAt - left.processedAt)
        .map(transaction => ({
          type: transaction.type,
          plan: transaction.plan,
          aiReplies: transaction.aiReplies,
          amount: transaction.amount,
          currency: transaction.currency,
          processedAt: transaction.processedAt
        }))
    });
  } catch (error) {
    console.error("Billing history fetch error:", error);
    res.status(500).json({ message: "Could not load billing history." });
  }
});

router.get("/activation/:paymentId", auth, async (req, res) => {
  if (
    req.user.role !== "user" ||
    String(req.user._id) !== String(req.workspaceOwner._id)
  ) {
    return res.status(403).json({
      message: "Only the workspace owner can check payment activation."
    });
  }

  const paymentId = req.params.paymentId;
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
    return res.status(400).json({ message: "Invalid payment ID." });
  }

  try {
    const owner = await User.findById(req.workspaceOwner._id)
      .select("+processedPaymentIds");
    if (!owner) {
      return res.status(404).json({ message: "Workspace owner not found." });
    }

    res.json({
      activated: owner.processedPaymentIds.includes(paymentId)
    });
  } catch (error) {
    console.error("Check payment activation error:", error);
    res.status(500).json({ message: "Could not check payment status." });
  }
});

router.post("/verify", auth, async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "invalid signature" });
    }

    return res.json({
      success: true,
      message: "payment verified"
    });

  } catch (error) {
    console.error("Verify payment error:", error);
    res.status(500).json({ message: "verification failed" });
  }
});

module.exports = router;
