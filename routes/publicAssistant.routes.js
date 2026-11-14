const express = require("express");
const { normalizeSupportMessages } = require("../services/supportAssistantService");
const {
  PUBLIC_DAILY_QUESTION_LIMIT,
  createPublicSalesAnswer,
  getPublicVisitorState,
  releasePublicVisitorQuestion,
  reservePublicVisitorQuestion
} = require("../services/publicSalesAssistantService");

const router = express.Router();

function getVisitorAddress(req) {
  return req.ip || req.socket?.remoteAddress || "";
}

router.get("/status", async (req, res) => {
  try {
    const state = await getPublicVisitorState(getVisitorAddress(req));
    res.json(state);
  } catch (error) {
    console.error("Public assistant status failed:", {
      code: error.code || null
    });
    res.status(503).json({
      message: "Growble's visitor assistant is temporarily unavailable."
    });
  }
});

router.post("/chat", async (req, res) => {
  let messages;
  try {
    messages = normalizeSupportMessages(req.body?.messages);
  } catch (error) {
    if (error.code === "INVALID_SUPPORT_MESSAGES") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Public assistant input validation failed:", error.message);
    return res.status(500).json({
      message: "Could not validate your question."
    });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return res.status(503).json({
      message: "The Growble assistant is temporarily unavailable."
    });
  }

  const visitorAddress = getVisitorAddress(req);
  let reservation;
  try {
    reservation = await reservePublicVisitorQuestion(visitorAddress);
    if (!reservation.allowed) {
      return res.status(429).json({
        message: "You have reached today's visitor chat limit. It resets at midnight UTC.",
        dailyLimit: PUBLIC_DAILY_QUESTION_LIMIT,
        questionsRemaining: 0,
        resetsAt: reservation.resetsAt
      });
    }

    const reply = await createPublicSalesAnswer(messages);
    res.json({
      reply,
      dailyLimit: reservation.dailyLimit,
      questionsRemaining: reservation.questionsRemaining,
      resetsAt: reservation.resetsAt
    });
  } catch (error) {
    if (reservation?.allowed) {
      try {
        await releasePublicVisitorQuestion(visitorAddress, reservation.day);
      } catch (releaseError) {
        console.error(
          "Public assistant quota rollback failed:",
          releaseError.message
        );
      }
    }

    if (
      error.code === "OPENAI_NOT_CONFIGURED" ||
      error.code === "PUBLIC_RATE_LIMIT_NOT_CONFIGURED"
    ) {
      return res.status(503).json({
        message: "The Growble assistant is temporarily unavailable."
      });
    }

    console.error("Public sales assistant failed:", {
      status: error.status || null,
      code: error.code || null
    });
    res.status(502).json({
      message: "The Growble assistant could not answer right now. Please try again or email support@growble.app."
    });
  }
});

module.exports = router;
