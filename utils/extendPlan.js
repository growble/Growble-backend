function extendPlan(currentExpiry, daysToAdd) {
  const now = new Date();

  const baseDate =
    !currentExpiry || new Date(currentExpiry) < now
      ? now
      : new Date(currentExpiry);

  baseDate.setDate(baseDate.getDate() + daysToAdd);
  return baseDate;
}

module.exports = extendPlan;
