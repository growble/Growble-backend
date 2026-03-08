const sendWhatsAppMessage = async ({ phone, message }) => {
  try {
    console.log(`📤 WhatsApp sent to ${phone}: ${message}`);
    return { success: true };
  } catch (error) {
    console.error("WhatsApp send failed:", error);
    return { success: false };
  }
};

module.exports = { sendWhatsAppMessage };
