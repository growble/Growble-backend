const mongoose = require("mongoose");

const CrmWorkflowSchema = new mongoose.Schema(
  {
    workspaceOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    name: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
    trigger: {
      type: String,
      enum: ["status_changed", "lead_created", "task_due"],
      default: "status_changed"
    },
    whenStatus: { type: String, trim: true, default: "" },
    action: {
      type: String,
      enum: ["create_task", "send_email", "assign_owner"],
      required: true
    },
    taskTitle: { type: String, trim: true, default: "" },
    emailSubject: { type: String, trim: true, default: "" },
    emailBody: { type: String, trim: true, default: "" },
    assignTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.models.CrmWorkflow || mongoose.model("CrmWorkflow", CrmWorkflowSchema);
