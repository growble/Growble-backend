const express = require("express");
const router = express.Router();
const Template = require("../models/Template");
const auth = require("../middleware/authMiddleware");

// GET templates
router.get("/", auth, async (req, res) => {
  let tpl = await Template.findOne({ user: req.user._id });

  if (!tpl) {
    tpl = await Template.create({
      user: req.user._id,
      templates: {}
    });
  }

  res.json(tpl.templates);
});

// SAVE templates
router.post("/", auth, async (req, res) => {
  const { templates } = req.body;

  let tpl = await Template.findOne({ user: req.user._id });

  if (!tpl) {
    tpl = new Template({
      user: req.user._id,
      templates
    });
  } else {
    tpl.templates = templates;
  }

  await tpl.save();

  res.json({ message: "Templates saved" });
});

module.exports = router;