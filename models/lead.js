const mongoose = require("mongoose");

const LeadSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    phone: {
  type: String,
  required: true,
  trim: true
},

    email: {
      type: String,
      lowercase: true
    },

    source: {
      type: String,
      enum: ["website", "whatsapp", "facebook", "manual", "other"],
      default: "manual"
    },

    status: {
      type: String,
      enum: ["new", "contacted", "interested", "closed", "lost"],
      default: "new"
    },

    notes: {
      type: String
    },

    lastContactedAt: {
      type: Date
    },

    nextFollowUpAt: {
      type: Date
    },
lostReason: {
  type: String,
  enum: ["expensive", "competitor", "not_interested", "no_response"],
  default: null
},

    // 👑 ADD HERE (INSIDE SCHEMA)
    activityLog: [
      {
        action: String,
        date: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true
  }
);
// ✅ Unique phone per user (compound index)
LeadSchema.index({ user: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model("Lead", LeadSchema);