const mongoose = require("mongoose");

const KnowledgeDocumentSchema = new mongoose.Schema(
  {
    workspaceOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180
    },
    text: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("KnowledgeDocument", KnowledgeDocumentSchema);
