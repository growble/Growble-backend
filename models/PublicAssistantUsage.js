const mongoose = require("mongoose");

const PublicAssistantUsageSchema = new mongoose.Schema(
  {
    ipHash: {
      type: String,
      required: true,
      unique: true
    },
    day: {
      type: String,
      required: true
    },
    count: {
      type: Number,
      default: 0,
      min: 0
    },
    expiresAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

PublicAssistantUsageSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

module.exports = mongoose.models.PublicAssistantUsage ||
  mongoose.model("PublicAssistantUsage", PublicAssistantUsageSchema);
