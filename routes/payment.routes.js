const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const auth = require("../middleware/authMiddleware");

// 🔑 Razorpay initialization
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * ✅ CREATE ORDER
 * Plan upgrade happens ONLY via webhook
 */
router.post("/create-order", auth, async (req, res) => {
  try {
    // 🔐 1. userId from auth middleware
    const userId = req.user.id;

    // 🔖 2. Plan & amount (backend controlled)
    const plan = "pro";
    const amount = 499; // ₹499

    // 🧾 3. Create Razorpay order with NOTES
    const order = await razorpay.orders.create({
      amount: amount * 100, // paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId: userId,
        plan: plan,
      },
    });

    // 🧪 Optional debug (remove later)
    console.log("ORDER NOTES:", order.notes);

    // 📤 4. Respond
    res.json({
      orderId: order.id,
      amount: order.amount,
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ error: "Order creation failed" });
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
