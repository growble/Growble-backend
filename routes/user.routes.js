const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const User = require("../models/User");
const { resetMonthlyUsage } = require("../utils/planUsage");
const { getPlanLimits, hasPlanFeature } = require("../utils/planEntitlements");

router.get("/me", auth, async (req, res) => {
  try {
    const user = req.user;
    const workspaceOwner = req.workspaceOwner;
    const limits = getPlanLimits(workspaceOwner.plan);
    const usageReset = resetMonthlyUsage(workspaceOwner);

    if (usageReset) {
      await workspaceOwner.save();
    }

    const usage = workspaceOwner.automationUsage.usage;
    const memberCount = await User.countDocuments({
      $or: [
        { _id: workspaceOwner._id },
        { workspaceOwner: workspaceOwner._id }
      ]
    });
    const safeUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      workspaceOwner: user.workspaceOwner || null,
      plan: workspaceOwner.plan,
      planExpiresAt: workspaceOwner.planExpiresAt,
      businessName: workspaceOwner.businessName,
      businessType: workspaceOwner.businessType,
      offer: workspaceOwner.offer,
      tone: workspaceOwner.tone,
      services: workspaceOwner.services,
      faq: workspaceOwner.faq,
      knowledgeBase: workspaceOwner.knowledgeBase,
      aiSetupCompleted: workspaceOwner.aiSetupCompleted,
      whatsapp: { connected: Boolean(workspaceOwner.whatsapp?.connected) }
    };

    res.json({
      success: true,
      user: safeUser,
      workspace: {
        ownerName: workspaceOwner.name,
        isOwner: String(user._id) === String(workspaceOwner._id),
        memberCount,
        seatLimit: limits.teamMembers
      },
      planExpired: req.planExpired || false,
      planExpiringSoon: req.planExpiringSoon || null,
      usage: {
        aiRepliesUsed: usage.aiReplies,
        aiRepliesLimit: limits.aiReplies,
        followUpsUsed: usage.followUps,
        followUpsLimit: limits.followUps,
        aiQualificationUsed: usage.aiQualification,
        aiQualificationLimit: limits.aiQualification,
        resetAt: usage.resetAt
      }
    });

  } catch (err) {
  console.error("/api/user/me error:", err);
  res.status(500).json({
    success: false,
    message: "server error"
  });
}
});

// ✅ Save business details
router.post("/setup", auth, async (req, res) => {
try {

const {

businessName,
businessType,
offer,

tone,
services,
faq,

fees,
hours,
extra

} = req.body;

    const user = req.workspaceOwner;

    if (!user) return res.status(404).json({ message: "User not found" });

    user.businessName = businessName;

user.businessType = businessType;

user.offer = offer;

user.tone = tone;

user.services = services;

user.faq = faq;

// AI knowledge base
const existingKnowledge =
user.knowledgeBase || "";

user.knowledgeBase = `

${existingKnowledge}

--------------------

Business Name:
${businessName}

Business Type:
${businessType}

Offer:
${offer}

Services:
${services}

Fees:
${fees}

Hours:
${hours}

FAQ:
${faq}

Extra:
${extra}

Tone:
${tone}

`;

user.aiSetupCompleted = true;

    await user.save();

    res.json({ message: "Business setup saved ✅" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
router.post(
"/connect-whatsapp",
auth,
async (req, res) => {
  if (!hasPlanFeature(req.workspaceOwner.plan, "whatsapp")) {
    return res.status(403).json({
      message: "WhatsApp integration is available on paid plans."
    });
  }

  const { whatsappPhoneId, whatsappToken, verifyToken } = req.body || {};
  if (
    typeof whatsappPhoneId !== "string" ||
    !whatsappPhoneId.trim() ||
    typeof whatsappToken !== "string" ||
    whatsappToken.length < 20 ||
    typeof verifyToken !== "string" ||
    !verifyToken.trim()
  ) {
    return res.status(400).json({ message: "WhatsApp connection details are invalid." });
  }

  try {
    req.workspaceOwner.whatsapp.phoneNumberId = whatsappPhoneId.trim();
    req.workspaceOwner.whatsapp.accessToken = whatsappToken;
    req.workspaceOwner.whatsapp.verifyToken = verifyToken.trim();
    req.workspaceOwner.whatsapp.connected = true;
    await req.workspaceOwner.save();
    res.json({ message: "WhatsApp connected." });
  } catch (error) {
    console.error("Save WhatsApp connection error:", error);
    res.status(500).json({ message: "Could not save WhatsApp connection." });
  }
});
module.exports = router;
