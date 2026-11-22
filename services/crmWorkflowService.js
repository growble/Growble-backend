const CrmWorkflow = require("../models/CrmWorkflow");
const emailService = require("./emailService");

async function runLeadWorkflows(workspaceOwner, lead, trigger) {
  if (!workspaceOwner) return [];

  const workflows = await CrmWorkflow.find({
    workspaceOwner: workspaceOwner._id,
    enabled: true,
    trigger
  });
  const results = [];

  for (const workflow of workflows) {
    if (
      workflow.trigger === "status_changed" &&
      workflow.whenStatus &&
      workflow.whenStatus !== lead.status
    ) {
      continue;
    }

    if (workflow.action === "create_task") {
      lead.tasks = lead.tasks || [];
      lead.tasks.push({
        title: workflow.taskTitle || `Follow up with ${lead.name}`,
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        assignedTo: workflow.assignTo || lead.owner || null,
        createdBy: workspaceOwner._id
      });
      results.push("create_task");
    }

    if (workflow.action === "assign_owner" && workflow.assignTo) {
      lead.owner = workflow.assignTo;
      results.push("assign_owner");
    }

    if (workflow.action === "send_email" && emailService.isConfigured()) {
      const recipient = lead.email || workspaceOwner.email;
      if (recipient) {
        await emailService.sendCrmEmail(
          recipient,
          workflow.emailSubject,
          workflow.emailBody
        );
        results.push("send_email");
      }
    }
  }

  return results;
}

module.exports = { runLeadWorkflows };
