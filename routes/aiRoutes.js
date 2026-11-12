const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const OpenAI = require("openai");

const checkPlan =
require("../middleware/checkPlan");
const getWorkspaceKnowledge = require("../utils/workspaceKnowledge");
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
    const workspaceOwner = req.workspaceOwner;
    const prompt = typeof req.body?.prompt === "string"
      ? req.body.prompt.trim()
      : "";

    if (!prompt) {
      return res.status(400).json({ message: "Prompt required" });
    }

    if (prompt.length > 1000) {
      return res.status(400).json({
        message: "Please keep the prompt under 1,000 characters."
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        message: "AI message generation is not configured. Please contact support."
      });
    }

    const usageReset = resetMonthlyUsage(workspaceOwner);
    if (usageReset) {
      await workspaceOwner.save();
    }

    if (
      workspaceOwner.role !== "admin" &&
      !hasRemainingUsage(workspaceOwner, "aiReplies")
    ) {
      return res.status(429).json({
        message: "AI reply limit reached. Upgrade your plan."
      });
    }

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You write concise WhatsApp follow-up messages for businesses of any type.

Create one natural message based on the user's situation. Keep the business's
industry and the customer's context in mind. Do not invent prices, offers, or
business details that were not provided.

Rules:
- Be friendly, professional, and concise.
- Keep it to 2-3 short lines in simple language.
- Do not add artificial urgency.
- Use an emoji only when it fits naturally.
          `
        },
        {
          role: "user",
          content: `Business knowledge:\n${await getWorkspaceKnowledge(workspaceOwner, prompt) || "No saved knowledge."}\n\nCustomer or business situation:\n${prompt}`
        }
      ]
    });

    const message = response.choices?.[0]?.message?.content?.trim();
    if (!message) {
      return res.status(502).json({
        message: "AI could not produce a message. Please try again."
      });
    }

    if (workspaceOwner.role !== "admin") {
      await recordPlanUsage(workspaceOwner, "aiReplies");
    }

    res.json({ message });

  } catch (err) {
    console.error("AI generation error:", {
      status: err.status,
      code: err.code,
      message: err.message
    });
    res.status(502).json({
      message: "The AI service is temporarily unavailable. Please try again."
    });
  }
});

module.exports = router;