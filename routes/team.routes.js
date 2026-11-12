const crypto = require("crypto");
const express = require("express");
const auth = require("../middleware/authMiddleware");
const TeamInvitation = require("../models/TeamInvitation");
const Lead = require("../models/Lead");
const KnowledgeDocument = require("../models/KnowledgeDocument");
const User = require("../models/User");
const emailService = require("../services/emailService");
const { getPlanLimits } = require("../utils/planEntitlements");

const router = express.Router();
const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function isWorkspaceOwner(req) {
  return String(req.user._id) === String(req.workspaceOwner._id);
}

function hashInvitationToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

router.use(auth);

router.get("/members", async (req, res) => {
  try {
    const workspaceOwnerId = req.workspaceOwner._id;
    const members = await User.find({
      $or: [{ _id: workspaceOwnerId }, { workspaceOwner: workspaceOwnerId }]
    })
      .select("name email role createdAt")
      .sort({ createdAt: 1 });

    res.json({
      members,
      canManage: isWorkspaceOwner(req),
      ownerId: String(workspaceOwnerId),
      seatLimit: getPlanLimits(req.workspaceOwner.plan).teamMembers
    });
  } catch (error) {
    console.error("List team members error:", error);
    res.status(500).json({ message: "Could not load team members." });
  }
});

router.get("/invitations", async (req, res) => {
  if (!isWorkspaceOwner(req)) {
    return res.status(403).json({ message: "Only the workspace owner can manage invitations." });
  }

  try {
    const invitations = await TeamInvitation.find({
      workspaceOwner: req.workspaceOwner._id,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    })
      .select("email expiresAt createdAt")
      .sort({ createdAt: -1 });
    res.json({ invitations });
  } catch (error) {
    console.error("List team invitations error:", error);
    res.status(500).json({ message: "Could not load team invitations." });
  }
});

router.post("/invitations", async (req, res) => {
  if (!isWorkspaceOwner(req)) {
    return res.status(403).json({ message: "Only the workspace owner can invite members." });
  }
  if (!emailService.isConfigured() || !process.env.APP_URL) {
    return res.status(503).json({
      message: "Team invitations require email and APP_URL configuration."
    });
  }

  const email = typeof req.body?.email === "string"
    ? req.body.email.trim().toLowerCase()
    : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }
  if (email === req.workspaceOwner.email.toLowerCase()) {
    return res.status(400).json({ message: "You are already the workspace owner." });
  }

  try {
    const limits = getPlanLimits(req.workspaceOwner.plan);
    const [memberCount, pendingCount, existingUser] = await Promise.all([
      User.countDocuments({
        $or: [
          { _id: req.workspaceOwner._id },
          { workspaceOwner: req.workspaceOwner._id }
        ]
      }),
      TeamInvitation.countDocuments({
        workspaceOwner: req.workspaceOwner._id,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { $gt: new Date() }
      }),
      User.findOne({ email }).select("workspaceOwner plan")
    ]);

    if (memberCount + pendingCount >= limits.teamMembers) {
      return res.status(403).json({
        message: `Your ${req.workspaceOwner.plan} plan allows ${limits.teamMembers} team member(s), including you.`
      });
    }
    if (existingUser?.workspaceOwner) {
      return res.status(409).json({
        message: "That account is already a member of another workspace."
      });
    }
    if (existingUser?.plan && existingUser.plan !== "free") {
      return res.status(409).json({
        message: "That account has its own paid workspace. Invite a new or Free-plan account instead."
      });
    }
    if (existingUser && await User.exists({ workspaceOwner: existingUser._id })) {
      return res.status(409).json({
        message: "That account already owns a team workspace and cannot join another one."
      });
    }

    await TeamInvitation.updateMany(
      {
        workspaceOwner: req.workspaceOwner._id,
        email,
        acceptedAt: null,
        revokedAt: null
      },
      { $set: { revokedAt: new Date() } }
    );

    const token = crypto.randomBytes(32).toString("hex");
    const invitation = await TeamInvitation.create({
      workspaceOwner: req.workspaceOwner._id,
      email,
      tokenHash: hashInvitationToken(token),
      expiresAt: new Date(Date.now() + INVITATION_LIFETIME_MS)
    });
    const inviteUrl =
      `${process.env.APP_URL.replace(/\/+$/, "")}/team-invite.html?token=${token}`;

    try {
      await emailService.sendTeamInvitationEmail(
        email,
        req.workspaceOwner.name,
        inviteUrl,
        req.workspaceOwner.plan
      );
    } catch (error) {
      await invitation.deleteOne();
      throw error;
    }

    res.status(201).json({ message: "Invitation sent." });
  } catch (error) {
    console.error("Create team invitation error:", error);
    res.status(500).json({ message: "Could not send the invitation." });
  }
});

router.post("/invitations/accept", async (req, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ message: "Invitation link is invalid or expired." });
  }

  try {
    const invitation = await TeamInvitation.findOne({
      tokenHash: hashInvitationToken(token),
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    });
    if (!invitation) {
      return res.status(400).json({ message: "Invitation link is invalid or expired." });
    }
    if (invitation.email !== req.user.email.toLowerCase()) {
      return res.status(403).json({
        message: `Sign in with ${invitation.email} to accept this invitation.`
      });
    }
    if (req.user.role === "admin") {
      return res.status(403).json({ message: "Admin accounts cannot join a team workspace." });
    }
    if (
      !req.user.workspaceOwner &&
      req.user.plan !== "free" &&
      String(req.user._id) !== String(invitation.workspaceOwner)
    ) {
      return res.status(409).json({
        message: "Paid workspace owners cannot join another workspace."
      });
    }
    if (
      !req.user.workspaceOwner &&
      await User.exists({ workspaceOwner: req.user._id })
    ) {
      return res.status(409).json({
        message: "Accounts that own a team workspace cannot join another one."
      });
    }
    if (req.user.workspaceOwner &&
        String(req.user.workspaceOwner) !== String(invitation.workspaceOwner)) {
      return res.status(409).json({
        message: "Leave your current workspace before accepting another invitation."
      });
    }

    const owner = await User.findById(invitation.workspaceOwner);
    if (!owner) {
      return res.status(404).json({ message: "The workspace owner account no longer exists." });
    }

    const limits = getPlanLimits(owner.plan);
    if (String(req.user._id) !== String(owner._id)) {
      const [workspaceDocumentCount, memberDocumentCount] = await Promise.all([
        KnowledgeDocument.countDocuments({ workspaceOwner: owner._id }),
        KnowledgeDocument.countDocuments({ workspaceOwner: req.user._id })
      ]);
      if (workspaceDocumentCount + memberDocumentCount > limits.knowledgeDocuments) {
        return res.status(403).json({
          message: "Your documents do not fit within this workspace’s knowledge-base limit. Remove documents or ask the owner to upgrade before accepting."
        });
      }
    }

    const memberCount = await User.countDocuments({
      $or: [{ _id: owner._id }, { workspaceOwner: owner._id }]
    });
    if (memberCount >= limits.teamMembers) {
      return res.status(403).json({
        message: "This workspace has reached its current plan seat limit."
      });
    }

    await Lead.updateMany(
      { user: req.user._id },
      { $set: { workspaceOwner: owner._id } }
    );
    await KnowledgeDocument.updateMany(
      {
        $or: [
          { workspaceOwner: req.user._id },
          { uploadedBy: req.user._id }
        ]
      },
      { $set: { workspaceOwner: owner._id } }
    );
    req.user.workspaceOwner = owner._id;
    await req.user.save();
    invitation.acceptedAt = new Date();
    await invitation.save();

    res.json({ message: "You joined the workspace.", workspaceOwner: owner.name });
  } catch (error) {
    console.error("Accept team invitation error:", error);
    res.status(500).json({ message: "Could not accept this invitation." });
  }
});

router.delete("/invitations/:id", async (req, res) => {
  if (!isWorkspaceOwner(req)) {
    return res.status(403).json({ message: "Only the workspace owner can revoke invitations." });
  }

  try {
    const invitation = await TeamInvitation.findOneAndUpdate(
      {
        _id: req.params.id,
        workspaceOwner: req.workspaceOwner._id,
        acceptedAt: null,
        revokedAt: null
      },
      { $set: { revokedAt: new Date() } },
      { new: true }
    );
    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found." });
    }
    res.json({ message: "Invitation revoked." });
  } catch (error) {
    console.error("Revoke team invitation error:", error);
    res.status(500).json({ message: "Could not revoke the invitation." });
  }
});

router.delete("/members/:id", async (req, res) => {
  if (!isWorkspaceOwner(req)) {
    return res.status(403).json({ message: "Only the workspace owner can remove members." });
  }
  if (String(req.params.id) === String(req.workspaceOwner._id)) {
    return res.status(400).json({ message: "The workspace owner cannot remove themselves." });
  }

  try {
    const member = await User.findOne({
      _id: req.params.id,
      workspaceOwner: req.workspaceOwner._id
    });
    if (!member) {
      return res.status(404).json({ message: "Team member not found." });
    }
    await Lead.updateMany(
      { user: member._id },
      { $unset: { workspaceOwner: 1 } }
    );
    await KnowledgeDocument.updateMany(
      { uploadedBy: member._id },
      { $set: { workspaceOwner: member._id } }
    );
    member.workspaceOwner = null;
    await member.save();
    res.json({ message: "Team member removed." });
  } catch (error) {
    console.error("Remove team member error:", error);
    res.status(500).json({ message: "Could not remove the team member." });
  }
});

module.exports = router;
