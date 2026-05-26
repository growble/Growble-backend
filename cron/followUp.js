const cron = require("node-cron");
const Lead = require("../models/Lead");
const followUps = require("../config/followUps");
const sendWhatsAppMessage = require("../utils/whatsappSender");

cron.schedule("* * * * *", async () => {
  console.log("⏰ Smart follow-up running...");

  const leads = await Lead.find({ replied: false });

  const now = new Date();

  for (let lead of leads) {
    const step = lead.followUpStep || 0;

    if (step >= followUps.length) continue;

    const followUp = followUps[step];

    const lastTime = lead.lastMessageAt || lead.createdAt;
    const nextTime = new Date(lastTime.getTime() + followUp.delay);

    if (now >= nextTime) {
      const message = followUp.message.replace("{{name}}", lead.name);

      await sendWhatsAppMessage({
  phone: lead.phone,
  message
});

      lead.followUpStep += 1;
      lead.lastMessageAt = new Date();

      await lead.save();

      console.log(`✅ Step ${step} sent to ${lead.name}`);
    }
  }
});