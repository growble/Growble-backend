const axios = require("axios");
const User = require("../models/User");
const Lead = require("../models/Lead");
const { encryptMetaToken, decryptMetaToken } = require("../utils/metaTokenCrypto");

const GRAPH_VERSION = "v26.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

function assertMetaConfiguration() {
  if (
    !process.env.META_APP_ID ||
    !process.env.META_APP_SECRET ||
    !/^[a-f0-9]{64}$/i.test(process.env.META_TOKEN_ENCRYPTION_KEY || "")
  ) {
    throw new Error("Facebook Lead Ads integration is not configured.");
  }
}

async function graphRequest(endpoint, accessToken, params = {}, method = "GET") {
  try {
    const response = await axios({
      method,
      url: `${GRAPH_URL}${endpoint}`,
      params: { ...params, access_token: accessToken }
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.error?.message;
    console.error("Facebook Lead Ads Graph API error:", message || error.message);
    throw new Error(message || "Facebook Graph API request failed.");
  }
}

async function exchangeForLongLivedToken(accessToken) {
  assertMetaConfiguration();
  const response = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
    params: {
      grant_type: "fb_exchange_token",
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      fb_exchange_token: accessToken
    }
  });
  return response.data.access_token;
}

async function getPages(accessToken) {
  const response = await graphRequest(
    "/me/accounts",
    accessToken,
    { fields: "id,name,access_token,tasks", limit: 100 }
  );
  return response.data || [];
}

async function listAvailablePages(accessToken) {
  const longLivedToken = await exchangeForLongLivedToken(accessToken);
  const pages = await getPages(longLivedToken);
  return pages.map(page => ({
    id: page.id,
    name: page.name || "Facebook Page"
  }));
}

async function connectPages(accessToken, requestedPageIds, userId) {
  if (!Array.isArray(requestedPageIds) || requestedPageIds.length === 0) {
    throw new Error("Select at least one Facebook Page.");
  }
  if (requestedPageIds.length > 20) {
    throw new Error("You can connect up to 20 Facebook Pages.");
  }

  const pageIds = [...new Set(requestedPageIds)];
  if (pageIds.some(id => typeof id !== "string" || !/^\d+$/.test(id))) {
    throw new Error("Invalid Facebook Page selection.");
  }

  const longLivedToken = await exchangeForLongLivedToken(accessToken);
  const availablePages = await getPages(longLivedToken);
  const pageMap = new Map(availablePages.map(page => [page.id, page]));
  const missingPage = pageIds.find(id => !pageMap.has(id));
  if (missingPage) {
    throw new Error("A selected Page is not available to this Facebook account. Reconnect and try again.");
  }

  const connectedPages = [];
  const failedPages = [];
  for (const pageId of pageIds) {
    const page = pageMap.get(pageId);
    if (!page.access_token) {
      failedPages.push({
        pageName: page.name || "Facebook Page",
        message: "Meta did not provide a Page access token."
      });
      continue;
    }

    const encryptedPageAccessToken = encryptMetaToken(page.access_token);
    try {
      await graphRequest(
        `/${page.id}/subscribed_apps`,
        page.access_token,
        { subscribed_fields: "leadgen" },
        "POST"
      );

      connectedPages.push({
        pageId: page.id,
        pageName: page.name || "Facebook Page",
        pageAccessToken: encryptedPageAccessToken,
        connectedAt: new Date()
      });
    } catch (error) {
      failedPages.push({
        pageName: page.name || "Facebook Page",
        message: error.message
      });
    }
  }

  if (!connectedPages.length) {
    throw new Error(failedPages[0]?.message || "Could not subscribe any Facebook Pages.");
  }

  const user = await User.findById(userId).select("+facebookLeadAds.pages.pageAccessToken");
  if (!user) {
    throw new Error("Growble account not found.");
  }

  const previousPages = user.facebookLeadAds?.pages || [];
  const connectedAt = user.facebookLeadAds?.connectedAt || new Date();
  const updatedPages = new Map(
    previousPages.map(page => [page.pageId, page.toObject ? page.toObject() : page])
  );

  connectedPages.forEach(page => updatedPages.set(page.pageId, page));

  user.facebookLeadAds = {
    connectedAt,
    pages: [...updatedPages.values()]
  };
  await user.save();

  return {
    connected: connectedPages.map(({ pageId, pageName }) => ({ pageId, pageName })),
    failed: failedPages,
    totalConnected: user.facebookLeadAds.pages.length
  };
}

async function disconnectPage(pageId, userId) {
  if (typeof pageId !== "string" || !/^\d+$/.test(pageId)) {
    throw new Error("Invalid Facebook Page.");
  }

  const user = await User.findById(userId)
    .select("+facebookLeadAds.pages.pageAccessToken");
  if (!user) {
    throw new Error("Growble account not found.");
  }

  const page = user.facebookLeadAds?.pages?.find(item => item.pageId === pageId);
  if (!page) {
    throw new Error("Facebook Page is not connected.");
  }

  await graphRequest(
    `/${pageId}/subscribed_apps`,
    decryptMetaToken(page.pageAccessToken),
    {},
    "DELETE"
  );

  user.facebookLeadAds.pages = user.facebookLeadAds.pages.filter(
    item => item.pageId !== pageId
  );
  if (!user.facebookLeadAds.pages.length) {
    user.facebookLeadAds.connectedAt = undefined;
  }
  await user.save();

  return { disconnected: true };
}

function fieldValue(fields, ...names) {
  const normalized = new Map(
    (fields || []).map(field => [
      String(field.name || "").toLowerCase(),
      Array.isArray(field.values) ? field.values[0] : field.values
    ])
  );
  for (const name of names) {
    const value = normalized.get(name);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

async function importLead({ pageId, leadgenId }) {
  const user = await User.findOne({
    "facebookLeadAds.pages.pageId": pageId
  }).select("+facebookLeadAds.pages.pageAccessToken");
  if (!user) {
    console.warn(`Facebook Lead Ads Page is not connected in Growble: ${pageId}`);
    return;
  }

  const page = user.facebookLeadAds.pages.find(item => item.pageId === pageId);
  if (!page?.pageAccessToken) {
    console.error(`Facebook Lead Ads access token unavailable for connected Page ${pageId}.`);
    return;
  }

  const alreadyImported = await Lead.exists({
    user: user._id,
    metaLeadId: leadgenId
  });
  if (alreadyImported) return;

  const leadData = await graphRequest(
    `/${encodeURIComponent(leadgenId)}`,
    decryptMetaToken(page.pageAccessToken),
    { fields: "id,created_time,field_data,form_id" }
  );
  const fields = leadData.field_data || [];
  const fullName = fieldValue(fields, "full_name", "name") ||
    [fieldValue(fields, "first_name"), fieldValue(fields, "last_name")]
      .filter(Boolean)
      .join(" ");
  const phone = fieldValue(fields, "phone_number", "phone", "mobile_phone");
  const email = fieldValue(fields, "email", "work_email");

  if (!phone) {
    console.warn(`Facebook Lead Ads lead ${leadgenId} skipped: form did not collect a phone number.`);
    return;
  }

  const lead = new Lead({
    user: user._id,
    workspaceOwner: user._id,
    name: fullName || "Facebook lead",
    phone,
    email,
    source: "facebook",
    metaLeadId: leadgenId,
    notes: `Facebook Lead Ads · ${page.pageName}`
  });

  try {
    await lead.save();
    console.log(`Facebook Lead Ads lead imported for Growble user ${user._id}.`);
  } catch (error) {
    if (error.code === 11000) {
      console.warn(`Facebook Lead Ads lead ${leadgenId} already exists or matches an existing phone number.`);
      return;
    }
    throw error;
  }
}

async function processWebhook(payload) {
  if (payload.object !== "page") return;
  for (const entry of payload.entry || []) {
    const pageId = String(entry.id || "");
    for (const change of entry.changes || []) {
      if (change.field !== "leadgen") continue;
      const leadgenId = String(change.value?.leadgen_id || "");
      if (!/^\d+$/.test(pageId) || !/^\d+$/.test(leadgenId)) {
        console.warn("Ignoring malformed Facebook Lead Ads webhook event.");
        continue;
      }
      await importLead({ pageId, leadgenId });
    }
  }
}

module.exports = {
  listAvailablePages,
  connectPages,
  disconnectPage,
  processWebhook
};
