module.exports = (...allowedPlans) => {

  return (req, res, next) => {

    if (req.user.role === "admin") {
      return next();
    }

    const plan = req.workspaceOwner?.plan || req.user.plan;
    if (!allowedPlans.includes(plan)) {
      return res.status(403).json({
        success: false,
        message: "Upgrade your plan to access this feature."
      });
    }

    next();

  };

};