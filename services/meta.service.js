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

async function getClientBusinessId(accessToken) {

  const data = await graphRequest({

    endpoint: "/me",

    accessToken,

    params: {
      fields: "client_business_id"
    }

  });

  return data.client_business_id;

}

async function getSharedWABAs(accessToken, businessId) {
  const data = await graphRequest({
    endpoint: `/${businessId}/client_whatsapp_business_accounts`,
    accessToken
  });

  return data.data || [];
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

async function connectCustomer(code, userId) {

  // 1. Exchange authorization code
  const accessToken = await exchangeCode(code);

  // 2. Get customer's Business ID
  const businessId = await getClientBusinessId(accessToken);

  // 3. Fetch customer's WABAs
  const wabas = await getSharedWABAs(
    accessToken,
    businessId
  );

  if (!wabas.length) {
    throw new Error("No WhatsApp Business Account found.");
  }

  const waba = wabas[0];

  // 4. Fetch phone numbers
  const phones = await getPhoneNumbers(
    accessToken,
    waba.id
  );

  if (!phones.length) {
    throw new Error("No business phone number found.");
  }

  const phone = phones[0];

  // 5. Subscribe webhook
  await subscribeApp(
    accessToken,
    waba.id
  );

  await User.findByIdAndUpdate(
  userId,
  {
    $set: {
      "whatsapp.connected": true,
      "whatsapp.businessId": businessId,
      "whatsapp.businessAccountId": waba.id,
      "whatsapp.wabaId": waba.id,
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
    wabaId: waba.id,
    phoneNumberId: phone.id,
    phoneNumber: phone.display_phone_number,
    displayName: phone.verified_name
  };

}

module.exports = {
  exchangeCode,
  getClientBusinessId,
  getSharedWABAs,
  getPhoneNumbers,
  subscribeApp,
  connectCustomer
};
