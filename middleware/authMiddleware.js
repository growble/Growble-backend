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

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (user.role !== "admin") {
      const expired = await planExpiryGuard(user);
      if (expired) {
        req.planExpired = true;
      } else if (user.planExpiresAt) {
        const diffDays = Math.ceil(
          (new Date(user.planExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays > 0 && diffDays <= 3) {
          req.planExpiringSoon = diffDays;
        }
      }

      if (!user.isActive) {
        return res.status(403).json({
          message: "Account suspended. Contact support."
        });
      }
  }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        tokenExpired: true,
        message: "Session expired. Please login again."
      });
    }

    console.error("Auth middleware error:", err);

    res.status(401).json({
      message: "Invalid token"
    });
  }
};