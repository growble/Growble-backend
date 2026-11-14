const express = require("express");
const router = express.Router();

const Lead = require("../models/Lead");
const auth = require("../middleware/authMiddleware");
const handleLeadAutomation = require("../services/automationService");
const sendWhatsAppMessage = require("../utils/whatsappSender");
const generateMessage = require("../utils/aiMessage");
const PLAN_LIMITS = require("../config/PlanLimits");
const { hasPlanFeature } = require("../utils/planEntitlements");
const { qualifyLeadForWorkspace } = require("../services/leadQualificationService");
const { getWorkspaceLeadQuery, getWorkspaceOwnerId } = require("../utils/workspace");
const {
  hasRemainingUsage,
  recordPlanUsage,
  resetMonthlyUsage
} = require("../utils/planUsage");
function presentLead(lead, plan) {
  const result = lead.toObject();
  if (!hasPlanFeature(plan, "advancedAnalytics")) {
    delete result.activityLog;
  }
  if (!hasPlanFeature(plan, "aiLeadQualification")) {
    delete result.aiScore;
    delete result.aiLeadTemperature;
    delete result.aiSentiment;
    delete result.aiSummary;
    delete result.aiNextAction;
  }
  return result;
}

/**
 * @route   POST /api/leads
 * @desc    Create a new lead
 * @access  Private
 */
router.post("/", auth, async (req, res) => {
  try {
    const { name, phone, email, source, notes, nextFollowUpAt } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        message: "Name and phone are required",
      });
    }

    const workspaceOwnerId = getWorkspaceOwnerId(req.user);
    const existingLead = await Lead.findOne({
      $and: [
        getWorkspaceLeadQuery(req.user),
        { phone: String(phone).trim() }
      ]
    });
    if (existingLead) {
      return res.status(400).json({
        message: "This phone number already exists in your leads."
      });
    }

    const lead = new Lead({
      user: req.user._id,
      workspaceOwner: workspaceOwnerId,
      name,
      phone,
      email,
      source,
      notes,
nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : null,
    });
const qualification = await qualifyLeadForWorkspace(lead, req.workspaceOwner);

await lead.save();

    res.status(201).json({
      message: "Lead created successfully",
      lead: presentLead(lead, req.workspaceOwner.plan),
  qualificationStatus: qualification.status
    });
  } catch (error) {
    console.error("Create lead error:", error);
    if (error.code === 11000) {
  return res.status(400).json({
    message: "This phone number already exists in your leads."
  });
}

res.status(500).json({
  message: "Server error",
});
  }
});

/**
 * @route   GET /api/leads
 * @desc    Get all leads of logged-in user
 * @access  Private
 */
router.get("/", auth, async (req, res) => {
  try {
    const leads = await Lead.find(getWorkspaceLeadQuery(req.user))
      .sort({ createdAt: -1 });

    res.status(200).json(
      leads.map(lead => presentLead(lead, req.workspaceOwner.plan))
    );

  } catch (error) {
    console.error("Get leads error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const lead = await Lead.findOne({
      $and: [
        { _id: req.params.id },
        getWorkspaceLeadQuery(req.user)
      ]
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    res.json(presentLead(lead, req.workspaceOwner.plan));
  } catch (error) {
    console.error("Get lead error:", error);
    res.status(500).json({ message: "Server error" });
  }
});
 


/**
 * @route   PUT /api/leads/:id
 * @desc    Update a lead and trigger plan-eligible automation
 * @access  Private
 */
router.put("/:id", auth, async (req, res) => {
  try {
    const { status, notes, nextFollowUpAt, followUpDate, name, phone, lostReason } = req.body;

    const lead = await Lead.findOne({
      $and: [
        { _id: req.params.id },
        getWorkspaceLeadQuery(req.user)
      ]
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const previousStatus = lead.status;

    // ✅ allow normal edits for everyone
    if (name !== undefined) lead.name = name;
    if (phone !== undefined) lead.phone = phone;
    if (status !== undefined) lead.status = status;
if (status === "lost") {
  lead.lostReason = lostReason || null;
}
    if (notes !== undefined) lead.notes = notes;

    // use whichever field your schema supports
    if (nextFollowUpAt !== undefined) {
  lead.nextFollowUpAt = nextFollowUpAt ? new Date(nextFollowUpAt) : null;
}
    if (followUpDate !== undefined) lead.followUpDate = followUpDate;

    lead.lastContactedAt = new Date();
    let qualification = { status: "not_requested" };
    if (
      status !== undefined ||
      notes !== undefined ||
      nextFollowUpAt !== undefined ||
      followUpDate !== undefined
    ) {
      qualification = await qualifyLeadForWorkspace(lead, req.workspaceOwner);
    }
    // Create activity log if not exists
if (!lead.activityLog) {
  lead.activityLog = [];
}

// Log status change
if (status !== undefined) {
  lead.activityLog.push({
    action: `Status changed to ${lead.status}`
  });
}

// Log follow-up change
if (nextFollowUpAt !== undefined) {
  lead.activityLog.push({
    action: `Follow-up set for ${nextFollowUpAt}`
  });
}

// Log notes update
if (notes !== undefined) {
  lead.activityLog.push({
    action: `Notes updated`
  });
}

   // ✅ automation only for PRO
if (hasPlanFeature(req.workspaceOwner.plan, "advancedAnalytics")) {
  await handleLeadAutomation(lead, previousStatus);
}

// 🔥 SAVE CHANGES TO DATABASE
await lead.save();

res.status(200).json({
  message: "Lead updated successfully",
  lead: presentLead(lead, req.workspaceOwner.plan),
  qualificationStatus: qualification.status
});
  } catch (error) {
    console.error("Update lead error:", error);
    if (error.code === 11000) {
  return res.status(400).json({
    message: "Another lead with this phone number already exists."
  });
}

res.status(500).json({ message: "Server error" });
  }
});


/**
 * @route   DELETE /api/leads/:id
 * @desc    Delete a lead
 * @access  Private
 */
router.delete("/:id", auth, async (req, res) => {
  try {
    const lead = await Lead.findOneAndDelete({
      $and: [
        { _id: req.params.id },
        getWorkspaceLeadQuery(req.user)
      ]
    });

    if (!lead) {
      return res.status(404).json({
        message: "Lead not found",
      });
    }

    res.status(200).json({
      message: "Lead deleted successfully",
    });
  } catch (error) {
    console.error("Delete lead error:", error);
    res.status(500).json({
      message: "Server error",
    });
  }
});

/**
 * @route   POST /api/leads/send-followups
 * @desc    Send due WhatsApp follow-ups and schedule the next follow-up
 * @access  Private + Pro
 */

const activeFollowupRuns = new Set();

router.post("/send-followups", auth, async (req, res) => {
  const userId = String(req.workspaceOwner._id);

  // Prevent simultaneous duplicate runs from the same user
  if (activeFollowupRuns.has(userId)) {
    return res.status(409).json({
      message: "A follow-up process is already running."
    });
  }

  activeFollowupRuns.add(userId);

  try {
    // Allow Pro and Agent plans
    if (!hasPlanFeature(req.workspaceOwner.plan, "whatsapp")) {
      return res.status(403).json({
        message: "WhatsApp follow-ups are not available on your current plan."
      });
    }

    const user = req.workspaceOwner;

    if (!user) {
      return res.status(404).json({
        message: "User account not found."
      });
    }

    if (resetMonthlyUsage(user)) {
      await user.save();
    }

    if (!hasRemainingUsage(user, "followUps")) {
      return res.status(429).json({
        message: "Monthly follow-up limit reached. Please upgrade."
      });
    }

    const now = new Date();

    // Only select due leads.
    // Do not message closed or lost leads.
    const dueLeadFilters = [
      getWorkspaceLeadQuery(req.user),
      {
        nextFollowUpAt: { $lte: now },
        status: { $nin: ["closed", "lost"] }
      }
    ];
    if (hasPlanFeature(user.plan, "advancedAnalytics")) {
      dueLeadFilters.push({ humanTakeover: { $ne: true } });
    }
    const dueLeads = await Lead.find({
      $and: dueLeadFilters
    }).sort({ nextFollowUpAt: 1 });

    if (!dueLeads.length) {
      return res.json({
        message: "No follow-ups are due.",
        sent: 0,
        failed: 0,
        remaining: 0,
        results: []
      });
    }

    if (
      !user.whatsapp?.connected ||
      !user.whatsapp.accessToken ||
      !user.whatsapp.phoneNumberId
    ) {
      return res.status(400).json({
        message: "Connect WhatsApp before sending follow-ups."
      });
    }

    // Process a limited batch to avoid long-running HTTP requests.
    const MAX_FOLLOWUPS_PER_RUN = 25;
    const followUpsUsed = user.automationUsage.usage.followUps || 0;
    const followUpsRemaining =
      (PLAN_LIMITS[user.plan] || PLAN_LIMITS.free).followUps -
      followUpsUsed;
    const batch = dueLeads.slice(
      0,
      Math.min(MAX_FOLLOWUPS_PER_RUN, followUpsRemaining)
    );

    let sent = 0;
    let failed = 0;

    const results = [];

    for (const lead of batch) {
      try {
        if (!lead.phone) {
          throw new Error("Phone number is missing.");
        }

        const phoneDigits = String(lead.phone).replace(/\D/g, "");

        if (phoneDigits.length < 8 || phoneDigits.length > 15) {
          throw new Error("Invalid phone number.");
        }

        // Generate a message using the existing Growble AI service.
        const prompt = `
Write a polite, natural WhatsApp follow-up message
for this business.

Lead name: ${lead.name || "Customer"}
Lead status: ${lead.status || "new"}
Lead notes: ${lead.notes || "No additional notes"}

Requirements:
- Address the lead by name.
- Keep the message short and conversational.
- Make the message relevant to the lead's status and notes.
- Ask one useful next-step question.
- Do not invent prices, discounts, offers, or business details.
- Do not use aggressive sales language.
- Return only the WhatsApp message.
`;

        const message = await generateMessage({
          message: prompt,
          user,
          lead
        });

        if (!message || !String(message).trim()) {
          throw new Error("Message generation failed.");
        }

        // Send through Growble's existing WhatsApp API utility.
        const providerMessageId = await sendWhatsAppMessage({
          phone: lead.phone,
          message: String(message).trim(),
          accessToken: user.whatsapp.accessToken,
          phoneNumberId: user.whatsapp.phoneNumberId
        });
        lead.conversation.push({
          role: "assistant",
          content: String(message).trim(),
          providerMessageId
        });

        // Schedule the next follow-up 2 calendar days later.
        const nextFollowUp = new Date();
        nextFollowUp.setDate(nextFollowUp.getDate() + 2);

        lead.lastContactedAt = new Date();
        lead.nextFollowUpAt = nextFollowUp;

        if (!lead.activityLog) {
          lead.activityLog = [];
        }

        lead.activityLog.push({
          action: "Automated WhatsApp follow-up sent"
        });

        lead.activityLog.push({
          action: `Next follow-up scheduled for ${nextFollowUp.toISOString()}`
        });

        await lead.save();
        await recordPlanUsage(user, "followUps");

        sent++;

        results.push({
          leadId: lead._id,
          name: lead.name,
          status: "sent",
          nextFollowUpAt: nextFollowUp
        });

      } catch (leadError) {
        failed++;

        console.error(
          `Follow-up failed for lead ${lead._id}:`,
          leadError
        );

        results.push({
          leadId: lead._id,
          name: lead.name,
          status: "failed",
          reason: leadError.message
        });

        if (leadError.code === "AI_REPLY_LIMIT_REACHED") {
          break;
        }
      }
    }

    const remaining = Math.max(0, dueLeads.length - results.length);

    res.json({
      message: `${sent} follow-up(s) sent. ${failed} failed.`,
      sent,
      failed,
      remaining,
      results
    });

  } catch (error) {
    console.error("Bulk follow-up error:", error);

    res.status(500).json({
      message: "Unable to process WhatsApp follow-ups."
    });

  } finally {
    activeFollowupRuns.delete(userId);
  }
});

/**
 * @route   POST /api/leads/run-automation
 * @desc    Run follow-up automation manually (PRO ONLY)
 * @access  Private + Pro
 */
router.post("/run-automation", auth, async (req, res) => {
  try {
    if (!hasPlanFeature(req.workspaceOwner.plan, "advancedAnalytics")) {
      return res.status(403).json({ message: "Pro plan required" });
    }

    const filters = [
      getWorkspaceLeadQuery(req.user),
      { nextFollowUpAt: { $lte: new Date() } },
      { humanTakeover: { $ne: true } }
    ];
    const leads = await Lead.find({
      $and: filters
    });

    if (!leads.length) {
      return res.json({ message: "No follow-ups due today." });
    }

    for (let lead of leads) {
      await handleLeadAutomation(lead, lead.status);
    }

    res.json({
      message: `${leads.length} follow-ups processed successfully.`
    });

  } catch (error) {
    console.error("Manual automation error:", error);
    res.status(500).json({ message: "Automation failed" });
  }
});

router.put("/:id/human-takeover", auth, async (req, res) => {
  if (!hasPlanFeature(req.workspaceOwner.plan, "advancedAnalytics")) {
    return res.status(403).json({
      message: "Human takeover is available on Pro and Agent plans."
    });
  }
  if (typeof req.body?.enabled !== "boolean") {
    return res.status(400).json({ message: "Set enabled to true or false." });
  }

  try {
    const lead = await Lead.findOne({
      $and: [
        { _id: req.params.id },
        getWorkspaceLeadQuery(req.user)
      ]
    });
    if (!lead) {
      return res.status(404).json({ message: "Lead not found." });
    }

    lead.humanTakeover = req.body.enabled;
    await lead.save();
    res.json({ humanTakeover: lead.humanTakeover });
  } catch (error) {
    console.error("Update human takeover error:", error);
    res.status(500).json({ message: "Could not update human takeover." });
  }
});

/**
 * @route POST /api/leads/:id/send-whatsapp
 * @desc Send WhatsApp message to lead on a paid plan
 */
router.post("/:id/send-whatsapp", auth, async (req, res) => {
  try {

    if (!hasPlanFeature(req.workspaceOwner.plan, "whatsapp")) {
      return res.status(403).json({
        message: "WhatsApp messaging is not available on your current plan."
      });
    }

    const lead = await Lead.findOne({
      $and: [
        { _id: req.params.id },
        getWorkspaceLeadQuery(req.user)
      ]
    });

    if (!lead) {
      return res.status(404).json({
        message: "Lead not found"
      });
    }

    const hasManualMessage = req.body?.message !== undefined;
    const manualMessage = typeof req.body?.message === "string"
      ? req.body.message.trim()
      : "";
    if (hasManualMessage && (!manualMessage || manualMessage.length > 1000)) {
      return res.status(400).json({
        message: "Enter a message between 1 and 1,000 characters."
      });
    }
    if (hasManualMessage && !hasPlanFeature(req.workspaceOwner.plan, "advancedAnalytics")) {
      return res.status(403).json({
        message: "Manual WhatsApp replies are available on Pro and Agent plans."
      });
    }
    if (hasManualMessage && !lead.humanTakeover) {
      return res.status(409).json({
        message: "Enable human takeover before sending a manual reply."
      });
    }
    if (lead.humanTakeover && !hasManualMessage) {
      return res.status(400).json({
        message: "Human takeover is active. Enter a manual reply to send."
      });
    }

    if (
      !req.workspaceOwner.whatsapp?.connected ||
      !req.workspaceOwner.whatsapp.accessToken ||
      !req.workspaceOwner.whatsapp.phoneNumberId
    ) {
      return res.status(400).json({
        message: "Connect WhatsApp before sending messages."
      });
    }

    if (resetMonthlyUsage(req.workspaceOwner)) {
      await req.workspaceOwner.save();
    }

    if (!hasRemainingUsage(req.workspaceOwner, "followUps")) {
      return res.status(429).json({
        message: "Monthly follow-up limit reached. Please upgrade."
      });
    }

    const message = manualMessage || await generateMessage({
      message: "follow up customer",
      user: req.workspaceOwner,
      lead
    });

    const providerMessageId = await sendWhatsAppMessage({
      phone: lead.phone,
      message,
      accessToken: req.workspaceOwner.whatsapp.accessToken,
      phoneNumberId: req.workspaceOwner.whatsapp.phoneNumberId
    });

    lead.conversation.push({
      role: "assistant",
      content: message,
      providerMessageId
    });
    lead.lastMessageAt = new Date();
    lead.lastContactedAt = lead.lastMessageAt;
    await lead.save();

    await recordPlanUsage(req.workspaceOwner, "followUps");

    res.json({
      message: "WhatsApp message sent successfully"
    });

  } catch (error) {
    console.error("WhatsApp send error:", error);
    if (error.code === "AI_REPLY_LIMIT_REACHED") {
      return res.status(429).json({ message: error.message });
    }
    res.status(500).json({
      message: "Failed to send WhatsApp message"
    });
  }
});

module.exports = router;
