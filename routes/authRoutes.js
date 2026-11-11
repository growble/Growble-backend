const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const emailService = require("../services/emailService");

const router = express.Router();

router.post("/forgot-password", async (req, res) => {
  const genericResponse = {
    message: "If an account exists for that email, a password reset link will be sent."
  };

  try {
    const email = typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    if (!emailService.isConfigured()) {
      console.error("Password reset email is not configured. Set EMAIL_USER and EMAIL_PASS.");
      return res.status(503).json({
        message: "Password reset is temporarily unavailable. Please contact support."
      });
    }

    let resetUrl;
    try {
      const appUrl = new URL(process.env.APP_URL || "https://growble.app");
      if (!["http:", "https:"].includes(appUrl.protocol)) {
        throw new Error("APP_URL must use HTTP or HTTPS.");
      }
      resetUrl = new URL("/reset-password.html", appUrl);
    } catch (error) {
      console.error("Invalid APP_URL configuration for password reset:", error.message);
      return res.status(503).json({
        message: "Password reset is temporarily unavailable. Please contact support."
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.json(genericResponse);
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    resetUrl.searchParams.set("token", token);

    try {
      await emailService.sendPasswordResetEmail(user.email, resetUrl.toString());
    } catch (emailError) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      console.error("Password reset email delivery failed:", emailError);
    }

    res.json(genericResponse);
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      message: "Could not process the password reset request. Please try again."
    });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body || {};

    if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        message: "This password reset link is invalid or has expired."
      });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        message: "Your new password must be at least 8 characters."
      });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() }
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user) {
      return res.status(400).json({
        message: "This password reset link is invalid or has expired."
      });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
      message: "Your password has been updated. You can now sign in."
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      message: "Could not update your password. Please try again."
    });
  }
});

/**
 * @route   POST /api/auth/signup
 * @desc    Register new user
 */
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

    // 🔥 First user becomes admin
    const usersCount = await User.countDocuments();

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: usersCount === 0 ? "admin" : "user",
      plan: "free",
      freeTrialUsed: false
    });

    // New users start on free plan
user.plan = "free";
user.planExpiresAt = null;

    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      userId: user._id,
      role: user.role
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    // 🔍 Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        message: "Invalid credentials"
      });
    }

    const now = new Date();
    const planExpired =
      user.planExpiresAt && now >= user.planExpiresAt;

    // Let expired subscribers sign in so they can continue on Free or renew.
    if (!user.isActive && !planExpired) {
      return res.status(403).json({
        message: "Account suspended. Contact support."
      });
    }

    // 🔐 Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials"
      });
    }

    if (planExpired) {
      if (user.plan !== "free") {
        user.plan = "free";
        user.freeTrialUsed = true;
      }
      user.isActive = true;
      user.planExpiresAt = null;
    }

// ✅ Update last login time
user.lastLogin = new Date();
await user.save();

    // 🎟 Generate JWT
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

module.exports = router;
