const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const checkPlan =
require("../middleware/checkPlan");
const {
  hasRemainingUsage,
  recordPlanUsage,
  resetMonthlyUsage
} = require("../utils/planUsage");

router.post(
  "/generate",
  auth,
  checkPlan("starter", "pro", "agent"),
  async (req, res) => {

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: "Prompt required" });
    }

    const usageReset = resetMonthlyUsage(req.user);
    if (usageReset) {
      await req.user.save();
    }

    if (
      req.user.role !== "admin" &&
      !hasRemainingUsage(req.user, "aiReplies")
    ) {
      return res.status(429).json({
        message: "AI reply limit reached. Upgrade your plan."
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `
You are a sales assistant for coaching institutes.

Write a short WhatsApp follow-up message.

Rules:
- Friendly tone
- Max 2-3 lines
- Include urgency if possible
- Use simple English
- Add emoji sometimes
          `
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const message = response.choices[0].message.content;

    if (req.user.role !== "admin") {
      await recordPlanUsage(req.user, "aiReplies");
    }

    res.json({ message });

  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ message: "AI failed" });
  }
});

module.exports = router;