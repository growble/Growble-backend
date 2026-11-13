const axios = require("axios");

const GRAPH_VERSION = "v26.0";

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
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
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
    const metaError = err.response?.data?.error;
    console.error("WhatsApp Graph API Error:", metaError || err.message);

    const sendError = new Error(
      metaError?.message || err.message || "WhatsApp message could not be sent."
    );
    if (metaError?.code !== undefined) {
      sendError.code = metaError.code;
    }
    if (metaError?.error_subcode !== undefined) {
      sendError.subcode = metaError.error_subcode;
    }

    throw sendError;
  }
};

module.exports = sendWhatsAppMessage;