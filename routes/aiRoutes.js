const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

router.post("/generate", auth, async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: "Prompt required" });
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

    res.json({ message });

  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ message: "AI failed" });
  }
});

module.exports = router;