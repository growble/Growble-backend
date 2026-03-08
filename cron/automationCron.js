const cron = require("node-cron");
const Lead = require("../models/Lead");
const User = require("../models/User");
const sendFollowUpEmail = require("../services/emailService");

function startAutomationCron() {
  cron.schedule("0 0 * * *", async () => {
    console.log("🔄 Midnight automation started...");

    try {
      const today = new Date();

      // Only Pro users
      const proUsers = await User.find({ plan: "pro" });

      for (let user of proUsers) {

        const leads = await Lead.find({
          user: user._id,
          nextFollowUpAt: { $lte: today }
        });

        for (let lead of leads) {

          // Send email reminder
          await sendFollowUpEmail(user.email, lead);

          // Add activity log
          if (!lead.activityLog) lead.activityLog = [];
          lead.activityLog.push({
            action: "Automatic follow-up email sent"
          });

          // Prevent repeat next day
          lead.nextFollowUpAt = null;

          await lead.save();
        }

        if (leads.length > 0) {
          console.log(`✅ Processed ${leads.length} leads for ${user.email}`);
        }
      }

      console.log("🎯 Midnight automation completed.");

    } catch (error) {
      console.error("❌ Automation Cron Error:", error);
    }

  }, {
    timezone: "Asia/Kolkata"
  });
}

module.exports = startAutomationCron;