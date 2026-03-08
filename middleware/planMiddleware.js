const User = require("../models/User");

const requireProPlan = async (req, res, next) => {
  if (!req.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await User.findById(req.userId);

  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }

  // 🔒 Plan expired
  if (!user.planExpiresAt || new Date(user.planExpiresAt) < new Date()) {
    return res.status(403).json({
      message: "Your plan has expired. Please upgrade.",
    });
  }

  // 🔒 Not pro
  if (user.plan !== "pro") {
    return res.status(403).json({
      message: "Upgrade to Pro to access this feature",
    });
  }

  next();
};

module.exports = { requireProPlan };
