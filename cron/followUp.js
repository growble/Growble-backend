const cron = require("node-cron");
const Lead = require("../models/Lead");
const User = require("../models/User");
const followUps = require("../config/followUps");
const sendWhatsAppMessage = require("../utils/whatsappSender");
const planExpiryGuard = require("../services/planExpiryGuard");
const {
  hasRemainingUsage,
  recordPlanUsage,
  resetMonthlyUsage
} = require("../utils/planUsage");

cron.schedule("* * * * *", async () => {
  console.log("⏰ Smart follow-up running...");

  try {
    const leads = await Lead.find({ replied: false });
    const now = new Date();

    for (const lead of leads) {
      const step = lead.followUpStep || 0;
      if (step >= followUps.length) continue;

      const followUp = followUps[step];
      const lastTime = lead.lastMessageAt || lead.createdAt;
      const nextTime = new Date(lastTime.getTime() + followUp.delay);
      if (now < nextTime) continue;

      const user = await User.findById(lead.user);
      if (!user) continue;

      await planExpiryGuard(user);
      if (!user.isActive) continue;

      if (resetMonthlyUsage(user, now)) {
        await user.save();
      }

      if (!hasRemainingUsage(user, "followUps")) continue;

      if (
        !user.whatsapp?.connected ||
        !user.whatsapp.accessToken ||
        !user.whatsapp.phoneNumberId
      ) {
        continue;
      }

      const message = followUp.message.replace("{{name}}", lead.name);
      const providerMessageId = await sendWhatsAppMessage({
        phone: lead.phone,
        message,
        accessToken: user.whatsapp.accessToken,
        phoneNumberId: user.whatsapp.phoneNumberId
      });

      await recordPlanUsage(user, "followUps");
      lead.conversation.push({
        role: "assistant",
        content: message,
        providerMessageId
      });
      lead.followUpStep += 1;
      lead.lastMessageAt = new Date();
      await lead.save();

      console.log(`✅ Step ${step} sent to ${lead.name}`);
    }
  } catch (error) {
    console.error("Smart follow-up scheduler error:", error);
  }
});