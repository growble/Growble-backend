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
const lowerText = text.toLowerCase();

      console.log("Incoming:", text);

      // ✅ STOP FOLLOW-UP
      const lead = await Lead.findOne({ phone: from });
const User = require("../models/User");

const user = lead
 ? await User.findById(lead.user)
 : null;

if (lead && text) {
  lead.conversation.push({
    role: "user",
    content: text
  });

  await lead.save();
}

      if (lead) {
        lead.replied = true;
        lead.status = "interested";
        await lead.save();

        console.log("🛑 Automation stopped for", lead.name);
      }

if (
  lead &&
  (
    lowerText.includes("demo") ||
    lowerText.includes("show me") ||
    lowerText.includes("how it works")
  )
) {
  lead.demoRequested = true;
  await lead.save();
}

      // ✅ AI REPLY
      const generateMessage = require("../utils/aiMessage");
      const sendWhatsAppMessage = require("../utils/whatsappSender");

      let reply;

if(
user &&
user.plan==="pro"
){

reply =
await generateMessage({
  message: text,
  user,
  lead
});

}else{

reply=
"Thanks for contacting us 😊 Our team will respond shortly.";

}

const lowerConversation =
JSON.stringify(
  lead?.conversation || []
).toLowerCase();

if (
  lead &&
  lead.requirement &&
  lead.budget &&
  lead.timeline
) {
  lead.aiLeadTemperature = "hot";
  await lead.save();
}



      console.log("AI Reply:", reply);
if (lead) {
  lead.conversation.push({
    role: "assistant",
    content: reply
  });

  await lead.save();
}



if (
  lead &&
  (
    lowerText.includes("call me") ||
    lowerText.includes("interested") ||
    lowerText.includes("book demo")
  )
) {
  lead.aiLeadTemperature = "hot";
  await lead.save();
}

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