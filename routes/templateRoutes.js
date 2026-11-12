const express = require("express");
const router = express.Router();
const Template = require("../models/Template");
const auth = require("../middleware/authMiddleware");
const checkPlan = require("../middleware/checkPlan");
const { getWorkspaceOwnerId } = require("../utils/workspace");

// GET templates
router.get("/", auth, checkPlan("starter", "pro", "agent"), async (req, res) => {
  const workspaceOwnerId = getWorkspaceOwnerId(req.user);
  let tpl = await Template.findOne({ user: workspaceOwnerId });

  if (!tpl) {
    tpl = await Template.create({
      user: workspaceOwnerId,
      templates: {}
    });
  }

  res.json(tpl.templates);
});

// SAVE templates
router.post("/", auth, checkPlan("starter", "pro", "agent"), async (req, res) => {
  const { templates } = req.body;
  if (!templates || typeof templates !== "object" || Array.isArray(templates)) {
    return res.status(400).json({ message: "Templates must be an object." });
  }

  const workspaceOwnerId = getWorkspaceOwnerId(req.user);
  let tpl = await Template.findOne({ user: workspaceOwnerId });

  if (!tpl) {
    tpl = new Template({
      user: workspaceOwnerId,
      templates
    });
  } else {
    tpl.templates = templates;
  }

  await tpl.save();

  res.json({ message: "Templates saved" });
});

module.exports = router;