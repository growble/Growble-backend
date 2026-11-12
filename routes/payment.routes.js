const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const auth = require("../middleware/authMiddleware");
const PLAN_LIMITS = require("../config/PlanLimits");

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
    if (String(req.user._id) !== String(req.workspaceOwner._id)) {
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
