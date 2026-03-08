const jwt = require("jsonwebtoken");
const User = require("../models/User");
const planExpiryGuard = require("../services/planExpiryGuard");

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔥 FETCH USER FROM DB
    const user = await User.findById(decoded.id).select("-password");
// 🔔 PLAN EXPIRY CHECK
if (user.planExpiresAt) {

  const now = new Date();
  const expiry = new Date(user.planExpiresAt);

  // ✅ Plan expired → shift to FREE
  if (now > expiry && user.plan !== "free") {
    user.plan = "free";
    user.planExpiresAt = null;
    await user.save();

    req.planExpired = true;
  }

  // ⚠ Plan expiring soon (3 days)
  const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

  if (diffDays > 0 && diffDays <= 3) {
    req.planExpiringSoon = diffDays;
  }

}

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

// 🔥 Skip plan check for admin
if (user.role !== "admin") {
  const active = await planExpiryGuard(user._id);

  if (!active || !user.isActive) {
    return res.status(403).json({
      message: "Plan expired. Please upgrade to continue."
    });
  }
}


    // ✅ Attach user to request
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};
