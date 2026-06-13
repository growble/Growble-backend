console.log("WA_PHONE_ID:", process.env.WA_PHONE_ID);
console.log("TOKEN EXISTS:", !!process.env.WA_ACCESS_TOKEN);
console.log(
  "TOKEN PREFIX:",
  process.env.WA_ACCESS_TOKEN?.substring(0, 15)
);
const axios = require("axios");

const sendWhatsAppMessage = async ({ phone, message }) => {
  try {
console.log("📦 Sending:", { phone, message });
    await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.WA_PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: {
          body: message
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Message sent:", phone);
  } catch (err) {
    console.error("❌ WhatsApp Error:", err.response?.data || err.message);
  }
};

module.exports = sendWhatsAppMessage;