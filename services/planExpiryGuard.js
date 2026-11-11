module.exports = async function planExpiryGuard(user) {
  if (!user) {
    throw new Error("User is required for plan expiry check");
  }

  if (!user.planExpiresAt) return false;

  const now = new Date();

  if (now < user.planExpiresAt) {
    return false;
  }

  if (user.plan !== "free") {
    user.plan = "free";
    user.freeTrialUsed = true;
  }

  // Plan expiry should limit features, not disable account access.
  user.isActive = true;
  user.planExpiresAt = null;
  await user.save();
  return true;
};
