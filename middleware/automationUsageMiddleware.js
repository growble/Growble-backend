const User = require("../models/User");

const MAX_PRO_AUTOMATIONS = 500; // change anytime

const checkAutomationUsage = async (req, res, next) => {
  const user = await User.findById(req.userId);

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = new Date();

  // 🔁 Monthly reset
  if (
    !user.automationUsage.resetAt ||
    now >= user.automationUsage.resetAt
  ) {
    user.automationUsage.count = 0;

    user.automationUsage.resetAt = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1
    );
  }

  // 🔒 Usage limit reached
  if (user.automationUsage.count >= MAX_PRO_AUTOMATIONS) {
    return res.status(403).json({
      message: "Monthly automation limit reached. Please wait or upgrade.",
    });
  }

  // 🔢 Increment usage
  user.automationUsage.count += 1;
  await user.save();

  next();
};

module.exports = checkAutomationUsage;
