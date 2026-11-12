const mongoose = require("mongoose");

const TeamInvitationSchema = new mongoose.Schema(
  {
    workspaceOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false
    },
    expiresAt: {
      type: Date,
      required: true
    },
    acceptedAt: Date,
    revokedAt: Date
  },
  { timestamps: true }
);

TeamInvitationSchema.index({ workspaceOwner: 1, email: 1 });

module.exports = mongoose.model("TeamInvitation", TeamInvitationSchema);
