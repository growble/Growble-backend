const axios = require("axios");

const sendWhatsAppMessage = async ({
  phone,
  message,
  accessToken,
  phoneNumberId
}) => {

  if (!accessToken) {
    throw new Error("Missing WhatsApp Access Token");
  }

  if (!phoneNumberId) {
    throw new Error("Missing Phone Number ID");
  }

  try {

    const response = await axios.post(
      `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
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
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ WhatsApp sent:", phone);
    return response.data.messages?.[0]?.id || null;

  } catch (err) {

    console.error(
      err.response?.data || err.message
    );

    throw err;

  }

};

module.exports = sendWhatsAppMessage;