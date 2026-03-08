const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

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
      plan: "free"
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

    // 🚫 Block suspended users
    if (!user.isActive) {
      return res.status(403).json({
        message: "Account suspended. Contact support."
      });
    }

    // ⏰ Auto-suspend on plan expiry
    const now = new Date();
    if (user.planExpiresAt && now > user.planExpiresAt) {
      user.isActive = false;
      await user.save();

      return res.status(403).json({
        message: "Plan expired. Please upgrade."
      });
    }

    // 🔐 Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials"
      });
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
