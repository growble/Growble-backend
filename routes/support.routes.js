const express = require("express");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const { resetMonthlyUsage } = require("../utils/planUsage");
const {
  DAILY_SUPPORT_QUESTION_LIMIT,
  buildWorkspaceSummary,
  createSupportAnswer,
  getDailySupportState,
  normalizeSupportMessages,
  releaseDailySupportQuestion,
  reserveDailySupportQuestion
} = require("../services/supportAssistantService");

const router = express.Router();

function requireRegularUser(req, res, next) {
  if (req.user?.role !== "user") {
    return res.status(403).json({
      message: "Growble support chat is available to signed-in workspace users."
    });
  }
  next();
}

async function getWorkspaceSummary(req) {
  const owner = req.workspaceOwner;
  if (!owner) {
    throw new Error("Workspace owner is unavailable.");
  }

  if (resetMonthlyUsage(owner)) {
    await owner.save();
  }

  const memberCount = await User.countDocuments({
    $or: [
      { _id: owner._id },
      { workspaceOwner: owner._id }
    ]
  });

  return buildWorkspaceSummary(
    owner,
    memberCount,
    String(req.user._id) === String(owner._id)
  );
}

router.get("/status", auth, requireRegularUser, async (req, res) => {
  try {
    const workspace = await getWorkspaceSummary(req);
    const supportState = getDailySupportState(req.user);
    res.json({
      dailyLimit: DAILY_SUPPORT_QUESTION_LIMIT,
      questionsRemaining: supportState.remaining,
      resetsAt: supportState.resetAt,
      workspace
    });
  } catch (error) {
    console.error("Support assistant status failed:", error.message);
    res.status(500).json({
      message: "Could not load support assistant status."
    });
  }
});

router.post("/chat", auth, requireRegularUser, async (req, res) => {
  let normalizedMessages;
  try {
    normalizedMessages = normalizeSupportMessages(req.body?.messages);
  } catch (error) {
    if (error.code === "INVALID_SUPPORT_MESSAGES") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Support assistant input validation failed:", error.message);
    return res.status(500).json({
      message: "Could not validate the support question."
    });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return res.status(503).json({
      message: "Growble support chat is temporarily unavailable. Please email support@growble.app."
    });
  }

  let reservation;
  try {
    const workspace = await getWorkspaceSummary(req);
    reservation = await reserveDailySupportQuestion(req.user._id);
    if (!reservation.allowed) {
      return res.status(429).json({
        message: "You have reached today's support chat limit. It resets at midnight UTC.",
        dailyLimit: DAILY_SUPPORT_QUESTION_LIMIT,
        questionsRemaining: 0,
        resetsAt: reservation.resetAt
      });
    }

    const reply = await createSupportAnswer(normalizedMessages, workspace);
    res.json({
      reply,
      dailyLimit: DAILY_SUPPORT_QUESTION_LIMIT,
      questionsRemaining: reservation.remaining,
      resetsAt: reservation.resetAt
    });
  } catch (error) {
    if (reservation?.allowed) {
      try {
        await releaseDailySupportQuestion(req.user._id, reservation.day);
      } catch (releaseError) {
        console.error(
          "Support question quota rollback failed:",
          releaseError.message
        );
      }
    }

    if (error.code === "SUPPORT_AI_NOT_CONFIGURED") {
      return res.status(503).json({
        message: "Growble support chat is temporarily unavailable. Please email support@growble.app."
      });
    }

    console.error("Support assistant response failed:", {
      status: error.status || null,
      code: error.code || null
    });
    res.status(502).json({
      message: "Growble support chat could not answer right now. Please try again or email support@growble.app."
    });
  }
});

module.exports = router;
