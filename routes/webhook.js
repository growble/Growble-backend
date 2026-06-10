const express = require("express");
const router = express.Router();
const Lead = require("../models/Lead");

router.get("/", (req, res) => {
  const VERIFY_TOKEN = "growble_token";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

router.post("/", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body;

      console.log("Incoming:", text);

      // ✅ STOP FOLLOW-UP
      const lead = await Lead.findOne({ phone: from });
const User = require("../models/User");

const user = lead
 ? await User.findById(lead.user).lean()
 : null;
      console.log("FULL USER:");
console.log(JSON.stringify(user, null, 2));
console.log("===== WEBHOOK DEBUG =====");
console.log("Lead User ID:", lead?.user);
console.log("User Found:", !!user);
console.log("User Object:", user);
console.log("Business:", user?.businessName);
console.log("Knowledge Length:", user?.knowledgeBase?.length);
console.log("========================");
      if (lead) {
        lead.replied = true;
        lead.status = "interested";
        await lead.save();

        console.log("🛑 Automation stopped for", lead.name);
      }

      // ✅ AI REPLY
      const generateMessage = require("../utils/aiMessage");
      const sendWhatsAppMessage = require("../utils/whatsappSender");

      let reply;

if(
user &&
user.plan==="pro"
){

reply=
await generateMessage({
message:text,
user
});

}else{

reply=
"Thanks for contacting us 😊 Our team will respond shortly.";

}

      console.log("AI Reply:", reply);

await sendWhatsAppMessage({
  phone: from,
  message: reply
});
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

module.exports = router;
