const jwt = require("jsonwebtoken");
const User = require("../models/User");
const planExpiryGuard = require("../services/planExpiryGuard");
const { getPlanLimits } = require("../utils/planEntitlements");

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

    const workspaceOwner = user.workspaceOwner
      ? await User.findById(user.workspaceOwner).select("-password")
      : user;
    if (!workspaceOwner) {
      return res.status(403).json({
        message: "Your workspace owner account is unavailable."
      });
    }

    if (user.role !== "admin") {
      const expired = await planExpiryGuard(workspaceOwner);
      if (expired) {
        req.planExpired = true;
      } else if (workspaceOwner.planExpiresAt) {
        const diffDays = Math.ceil(
          (new Date(workspaceOwner.planExpiresAt) - new Date()) /
            (1000 * 60 * 60 * 24)
        );

        if (diffDays > 0 && diffDays <= 3) {
          req.planExpiringSoon = diffDays;
        }
      }

      if (!user.isActive || !workspaceOwner.isActive) {
        return res.status(403).json({
          message: "Account suspended. Contact support."
        });
      }

      if (user.workspaceOwner) {
        const seatLimit = getPlanLimits(workspaceOwner.plan).teamMembers;
        const allowedMembers = seatLimit <= 1
          ? []
          : await User.find({ workspaceOwner: workspaceOwner._id })
              .sort({ createdAt: 1 })
              .select("_id")
              .limit(Number.isFinite(seatLimit) ? seatLimit - 1 : 0);
        if (!allowedMembers.some(member => String(member._id) === String(user._id))) {
          return res.status(403).json({
            message: "Your workspace has exceeded its plan seat limit. Ask the owner to upgrade or remove a member."
          });
        }
      }
  }

    req.user = user;
    req.workspaceOwner = workspaceOwner;
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