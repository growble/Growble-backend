const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Lead = require("../models/Lead");
const auth = require("../middleware/authMiddleware");
const { requireProPlan } = require("../middleware/planMiddleware");
const handleLeadAutomation = require("../services/automationService");
const checkAutomationUsage = require("../middleware/automationUsageMiddleware");

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

    const lead = new Lead({
      user: req.user._id,
      name,
      phone,
      email,
      source,
      notes,
nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : null,
    });

    await lead.save();
// 🎁 START FREE TRIAL WHEN FIRST LEAD ADDED
const user = await User.findById(req.user.id);

if (user.plan === "free" && !user.planExpiresAt) {

  user.plan = "pro";

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 14);

  user.planExpiresAt = expiry;

  await user.save();
}

    res.status(201).json({
      message: "Lead created successfully",
      lead,
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
    let leads = await Lead.find({ user: req.user._id }).sort({ createdAt: -1 });

    // Remove activity log for free users
    if (req.user.plan !== "pro") {
      leads = leads.map(lead => {
        const obj = lead.toObject();
        delete obj.activityLog;
        return obj;
      });
    }

    res.status(200).json(leads);

  } catch (error) {
    console.error("Get leads error:", error);
    res.status(500).json({ message: "Server error" });
  }
});
 


/**
 * @route   PUT /api/leads/:id
 * @desc    Update lead + trigger automation (PRO ONLY)
 * @access  Private + Pro
 */
router.put("/:id", auth, async (req, res) => {
  try {
    const { status, notes, nextFollowUpAt, followUpDate, name, phone, lostReason } = req.body;

    const lead = await Lead.findOne({
      _id: req.params.id,
      user: req.user._id,
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

await lead.save();

    // ✅ automation only for PRO
    if (req.user.plan === "pro") {
      await handleLeadAutomation(lead, previousStatus);
    }

    res.status(200).json({
      message: "Lead updated successfully",
      lead,
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
      _id: req.params.id,
      user: req.user._id,
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
 * @route   POST /api/leads/run-automation
 * @desc    Run follow-up automation manually (PRO ONLY)
 * @access  Private + Pro
 */
router.post("/run-automation", auth, async (req, res) => {
  try {
    if (req.user.plan !== "pro") {
      return res.status(403).json({ message: "Pro plan required" });
    }

    const leads = await Lead.find({
      user: req.user._id,
      nextFollowUpAt: { $lte: new Date() }
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
/**
 * @route POST /api/leads/:id/send-whatsapp
 * @desc Send WhatsApp message to lead (PRO ONLY)
 */
router.post("/:id/send-whatsapp", auth, async (req, res) => {
  try {

    if (req.user.plan !== "pro") {
      return res.status(403).json({
        message: "WhatsApp messaging is a Pro feature"
      });
    }

    const lead = await Lead.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!lead) {
      return res.status(404).json({
        message: "Lead not found"
      });
    }

    const message = `Hello ${lead.name}, just following up with you.`;

    const { sendWhatsAppMessage } = require("../services/whatsappService");

    await sendWhatsAppMessage({
      phone: lead.phone,
      message
    });

    res.json({
      message: "WhatsApp message sent successfully"
    });

  } catch (error) {
    console.error("WhatsApp send error:", error);
    res.status(500).json({
      message: "Failed to send WhatsApp message"
    });
  }
});

module.exports = router;
