module.exports = (...allowedPlans) => {

  return (req, res, next) => {

    if (req.user.role === "admin") {
      return next();
    }

    if (!allowedPlans.includes(req.user.plan)) {
      return res.status(403).json({
        success: false,
        message: "Upgrade your plan to access this feature."
      });
    }

    next();

  };

};