const cron = require("node-cron");
const Lead = require("../models/Lead");
const User = require("../models/User");
const { sendWhatsAppMessage } = require("./whatsappService");

const PLAN_LIMITS = {
  free: 0,
  starter: 50,
  pro: Infinity
};

const startFollowUpScheduler = () => {
  cron.schedule("* * * * *", async () => {
    console.log("🕐 Scheduler tick", new Date().toISOString());

    try {
      const now = new Date();

      const leads = await Lead.find({
        status: "follow-up",
        nextFollowUpAt: { $lte: now }
      });

      console.log(`🔎 Leads found: ${leads.length}`);

      for (const lead of leads) {
        const user = await User.findById(lead.user);

        if (!user) {
          console.log(`⚠️ User not found for lead ${lead._id}`);
          continue;
        }

        // 🔁 Monthly reset
        if (now >= user.automationUsage.resetAt) {
          user.automationUsage.count = 0;
          user.automationUsage.resetAt = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            1
          );
        }

        const limit = PLAN_LIMITS[user.plan];

        if (limit === 0) {
          console.log(`🚫 Blocked (plan=${user.plan})`);
          lead.nextFollowUpAt = null;
          await lead.save();
          await user.save();
          continue;
        }

        if (user.automationUsage.count >= limit) {
          console.log(`⛔ Limit reached (${limit})`);
          lead.nextFollowUpAt = null;
          await lead.save();
          await user.save();
          continue;
        }

        const message = `Hi ${lead.name}, this is a reminder from Growble regarding your enquiry.`;

        await sendWhatsAppMessage({
          phone: lead.phone,
          message
        });

        user.automationUsage.count += 1;

        console.log(
          `✅ WhatsApp sent | Usage ${user.automationUsage.count}/${limit}`
        );

        lead.nextFollowUpAt = null;
        await lead.save();
        await user.save();
      }
    } catch (error) {
      console.error("❌ Scheduler error:", error);
    }
  });

  console.log("⏳ Follow-up scheduler started");
};

module.exports = startFollowUpScheduler;
