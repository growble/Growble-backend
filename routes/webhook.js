const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Lead = require("../models/Lead");
const User = require("../models/User");
const PLAN_LIMITS = require("../config/PlanLimits");
const sendWhatsAppMessage = require("../utils/whatsappSender");
const facebookLeadAdsService = require("../services/facebookLeadAds.service");

router.get("/", (req, res) => {
  const VERIFY_TOKEN =
process.env.WEBHOOK_VERIFY_TOKEN;

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
    const appSecret = process.env.META_APP_SECRET;
    const signature = req.get("x-hub-signature-256");
    if (!appSecret || !signature || !req.rawBody) {
      return res.sendStatus(401);
    }

    const expectedSignature = `sha256=${crypto
      .createHmac("sha256", appSecret)
      .update(req.rawBody)
      .digest("hex")}`;
    const expectedBuffer = Buffer.from(expectedSignature);
    const signatureBuffer = Buffer.from(signature);
    if (
      expectedBuffer.length !== signatureBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
    ) {
      return res.sendStatus(401);
    }

    if (req.body.object === "page") {
      await facebookLeadAdsService.processWebhook(req.body);
      return res.sendStatus(200);
    }

    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const phoneNumberId = changes?.value?.metadata?.phone_number_id;
    const message = changes?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body;
      if (!text) {
        return res.sendStatus(200);
      }

      const lowerText = text.toLowerCase();

      // ✅ STOP FOLLOW-UP
      const user = phoneNumberId
        ? await User.findOne({
          "whatsapp.phoneNumberId": phoneNumberId,
          "whatsapp.connected": true
        })
        : null;
      const lead = user
        ? await Lead.findOne({ user: user._id, phone: from })
        : null;

      const alreadyRecorded = Boolean(
        lead &&
        message.id &&
        lead.conversation.some(item => item.providerMessageId === message.id)
      );
      const alreadyReplied = Boolean(
        lead &&
        message.id &&
        lead.conversation.some(item => item.replyToMessageId === message.id)
      );

      if (alreadyReplied) {
        return res.sendStatus(200);
      }

if (lead && text && !alreadyRecorded) {
  lead.conversation.push({
    role: "user",
    content: text,
    providerMessageId: message.id
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

      let reply;

      const aiReplyLimit = PLAN_LIMITS[user?.plan]?.aiReplies || 0;
      if (user && aiReplyLimit > 0) {
        reply = await generateMessage({
          message: text,
          user,
          lead
        });
      } else {
        reply = "Thanks for contacting us 😊 Our team will respond shortly.";
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

      if (
        user?.whatsapp?.connected &&
        user.whatsapp.accessToken &&
        user.whatsapp.phoneNumberId
      ) {
        const providerMessageId = await sendWhatsAppMessage({
          phone: from,
          message: reply,
          accessToken: user.whatsapp.accessToken,
          phoneNumberId: user.whatsapp.phoneNumberId
        });

        if (lead) {
          lead.conversation.push({
            role: "assistant",
            content: reply,
            providerMessageId,
            replyToMessageId: message.id
          });
          await lead.save();
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    if (err.code === "AI_REPLY_LIMIT_REACHED") {
      return res.sendStatus(200);
    }
    res.sendStatus(500);
  }
});

module.exports = router;