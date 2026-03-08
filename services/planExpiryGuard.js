const User = require("../models/User");

module.exports = async function planExpiryGuard(userId) {
  const user = await User.findById(userId);

  // Free plan without expiry
  if (!user.planExpiresAt) return true;

  const now = new Date();

  if (now > user.planExpiresAt) {
    user.isActive = false;
    await user.save();
    return false; // expired
  }

  return true; // active
};
