const axios = require("axios");
const User = require("../models/User");

const GRAPH_VERSION = "v26.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;
async function graphRequest({
  method = "GET",
  endpoint,
  accessToken,
  params = {},
  data = {}
}) {
  try {
    const response = await axios({
      method,
      url: `${GRAPH_URL}${endpoint}`,
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      params,
      data
    });

    return response.data;
  } catch (err) {
    console.error(
      "Meta Graph API Error:",
      err.response?.data || err.message
    );

    throw new Error(
      err.response?.data?.error?.message ||
      "Meta Graph API Error"
    );
  }
}


async function exchangeCode(code) {

  const response = await axios.get(
    `${GRAPH_URL}/oauth/access_token`,
    {
      params: {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        code
      }
    }
  );

  return response.data.access_token;

}

async function getPhoneNumbers(accessToken, wabaId) {
  const data = await graphRequest({
    endpoint: `/${wabaId}/phone_numbers`,
    accessToken
  });

  return data.data || [];
}

async function subscribeApp(accessToken, wabaId) {
  return await graphRequest({
    method: "POST",
    endpoint: `/${wabaId}/subscribed_apps`,
    accessToken
  });
}

async function connectCustomer({
  code,
  wabaId,
  phoneNumberId,
  businessId
}, userId) {
  const accessToken = await exchangeCode(code);

  const phones = await getPhoneNumbers(
    accessToken,
    wabaId
  );
  const phone = phones.find(item => String(item.id) === String(phoneNumberId));
  if (!phone) {
    throw new Error("The phone number selected during WhatsApp signup was not found.");
  }

  await subscribeApp(accessToken, wabaId);

  await User.findByIdAndUpdate(
  userId,
  {
    $set: {
      "whatsapp.connected": true,
      "whatsapp.businessId": businessId || "",
      "whatsapp.businessAccountId": wabaId,
      "whatsapp.wabaId": wabaId,
      "whatsapp.phoneNumberId": phone.id,
      "whatsapp.phoneNumber": phone.display_phone_number,
      "whatsapp.displayName": phone.verified_name || "",
      "whatsapp.accessToken": accessToken,
      "whatsapp.verifyToken": process.env.WEBHOOK_VERIFY_TOKEN,
      "whatsapp.connectedAt": new Date(),
      "whatsapp.lastSyncedAt": new Date()
    }
  }
);

  return {
    connected: true,
    businessId,
    wabaId,
    phoneNumberId: phone.id,
    phoneNumber: phone.display_phone_number,
    displayName: phone.verified_name
  };

}

module.exports = {
  exchangeCode,
  getPhoneNumbers,
  subscribeApp,
  connectCustomer
};
