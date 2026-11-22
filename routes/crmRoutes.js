const express = require("express");
const auth = require("../middleware/authMiddleware");
const Lead = require("../models/Lead");
const User = require("../models/User");
const CrmWorkflow = require("../models/CrmWorkflow");
const { getWorkspaceLeadQuery } = require("../utils/workspace");

const router = express.Router();

router.use(auth);

function canManage(req) {
  return String(req.user._id) === String(req.workspaceOwner._id) ||
    req.user.workspaceRole === "manager";
}

router.get("/config", async (req, res) => {
  try {
    const members = await User.find({
      $or: [
        { _id: req.workspaceOwner._id },
        { workspaceOwner: req.workspaceOwner._id }
      ]
    }).select("name email workspaceRole role").sort({ name: 1 });

    const workflows = await CrmWorkflow.find({
      workspaceOwner: req.workspaceOwner._id
    }).sort({ createdAt: -1 });

    res.json({
      pipeline: req.workspaceOwner.crmPipeline,
      members,
      workflows,
      canManage: canManage(req)
    });
  } catch (error) {
    console.error("Get CRM config error:", error);
    res.status(500).json({ message: "Could not load CRM settings." });
  }
});

router.put("/pipeline", async (req, res) => {
  if (!canManage(req)) {
    return res.status(403).json({ message: "Only managers and workspace owners can edit the pipeline." });
  }

  const pipeline = Array.isArray(req.body?.pipeline)
    ? [...new Set(req.body.pipeline.map(stage => String(stage).trim()).filter(Boolean))]
    : [];
  if (pipeline.length < 2) {
    return res.status(400).json({ message: "A pipeline needs at least two stages." });
  }

  req.workspaceOwner.crmPipeline = pipeline;
  await req.workspaceOwner.save();
  res.json({ pipeline });
});

router.post("/workflows", async (req, res) => {
  if (!canManage(req)) {
    return res.status(403).json({ message: "Only managers and workspace owners can create workflows." });
  }

  try {
    const workflow = await CrmWorkflow.create({
      workspaceOwner: req.workspaceOwner._id,
      name: req.body?.name,
      enabled: req.body?.enabled !== false,
      trigger: req.body?.trigger || "status_changed",
      whenStatus: req.body?.whenStatus || "",
      action: req.body?.action,
      taskTitle: req.body?.taskTitle || "",
      emailSubject: req.body?.emailSubject || "",
      emailBody: req.body?.emailBody || "",
      assignTo: req.body?.assignTo || null
    });
    res.status(201).json({ workflow });
  } catch (error) {
    res.status(400).json({ message: error.message || "Could not create workflow." });
  }
});

router.patch("/workflows/:id", async (req, res) => {
  if (!canManage(req)) {
    return res.status(403).json({ message: "Only managers and workspace owners can edit workflows." });
  }
  const workflow = await CrmWorkflow.findOneAndUpdate(
    { _id: req.params.id, workspaceOwner: req.workspaceOwner._id },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!workflow) return res.status(404).json({ message: "Workflow not found." });
  res.json({ workflow });
});

router.delete("/workflows/:id", async (req, res) => {
  if (!canManage(req)) {
    return res.status(403).json({ message: "Only managers and workspace owners can delete workflows." });
  }
  const workflow = await CrmWorkflow.findOneAndDelete({
    _id: req.params.id,
    workspaceOwner: req.workspaceOwner._id
  });
  if (!workflow) return res.status(404).json({ message: "Workflow not found." });
  res.json({ message: "Workflow deleted." });
});

router.post("/leads/:leadId/tasks", async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!title) return res.status(400).json({ message: "Task title is required." });

  const lead = await Lead.findOne({
    $and: [{ _id: req.params.leadId }, getWorkspaceLeadQuery(req.user)]
  });
  if (!lead) return res.status(404).json({ message: "Lead not found." });

  lead.tasks.push({
    title,
    dueAt: req.body?.dueAt ? new Date(req.body.dueAt) : null,
    assignedTo: req.body?.assignedTo || req.user._id,
    createdBy: req.user._id
  });
  lead.activityLog.push({ action: `Task added: ${title}` });
  await lead.save();

  res.status(201).json({ task: lead.tasks[lead.tasks.length - 1] });
});

router.patch("/leads/:leadId/tasks/:taskId", async (req, res) => {
  const lead = await Lead.findOne({
    $and: [{ _id: req.params.leadId }, getWorkspaceLeadQuery(req.user)]
  });
  if (!lead) return res.status(404).json({ message: "Lead not found." });

  const task = lead.tasks.id(req.params.taskId);
  if (!task) return res.status(404).json({ message: "Task not found." });
  task.completed = req.body?.completed !== false;
  task.completedAt = task.completed ? new Date() : null;
  lead.activityLog.push({ action: task.completed ? `Task completed: ${task.title}` : `Task reopened: ${task.title}` });
  await lead.save();
  res.json({ task });
});

router.get("/analytics", async (req, res) => {
  const query = getWorkspaceLeadQuery(req.user);
  const [leads, sourceRows, campaignRows, pipelineRows, overdueTasks] = await Promise.all([
    Lead.find(query).select("status pipelineStage dealValue source campaign owner tasks expectedCloseDate"),
    Lead.aggregate([
      { $match: query },
      { $group: { _id: { $ifNull: ["$source", "other"] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Lead.aggregate([
      { $match: query },
      { $group: { _id: { $ifNull: ["$campaign", ""] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Lead.aggregate([
      { $match: query },
      { $group: { _id: { $ifNull: ["$pipelineStage", "New"] }, count: { $sum: 1 }, dealValue: { $sum: "$dealValue" } } },
      { $sort: { count: -1 } }
    ]),
    Lead.aggregate([
      { $match: { ...query, "tasks.completed": false, "tasks.dueAt": { $lte: new Date() } } },
      { $project: { name: 1, overdueTasks: { $filter: { input: "$tasks", as: "task", cond: { $and: [{ $eq: ["$$task.completed", false] }, { $lte: ["$$task.dueAt", new Date()] }] } } } } }
    ])
  ]);

  const openDeals = leads.filter(lead => !["closed", "lost"].includes(lead.status));
  res.json({
    sources: sourceRows,
    campaigns: campaignRows,
    pipeline: pipelineRows,
    openDealValue: openDeals.reduce((total, lead) => total + (lead.dealValue || 0), 0),
    overdueTaskCount: overdueTasks.reduce((total, lead) => total + lead.overdueTasks.length, 0),
    closingThisMonth: leads.filter(lead => {
      if (!lead.expectedCloseDate) return false;
      const close = new Date(lead.expectedCloseDate);
      const now = new Date();
      return close.getFullYear() === now.getFullYear() && close.getMonth() === now.getMonth();
    }).length
  });
});

module.exports = router;
