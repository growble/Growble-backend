const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const metaService = require("../services/meta.service");
const facebookLeadAdsService = require("../services/facebookLeadAds.service");
const { hasPlanFeature } = require("../utils/planEntitlements");

function requireLeadAdsPlan(req, res, next) {
  if (!hasPlanFeature(req.workspaceOwner.plan, "facebookLeadAds")) {
    return res.status(403).json({
      success: false,
      message: "Facebook Lead Ads integration is available on Pro and Agent plans."
    });
  }
  next();
}

function requireWhatsAppPlan(req, res, next) {
  if (!hasPlanFeature(req.workspaceOwner.plan, "whatsapp")) {
    return res.status(403).json({
      success: false,
      message: "WhatsApp integration is available on paid plans."
    });
  }
  next();
}

router.get(
  "/facebook-leads/config",
  authMiddleware,
  requireLeadAdsPlan,
  (req, res) => {
    if (
      !process.env.META_APP_ID ||
      !process.env.META_APP_SECRET ||
      !/^[a-f0-9]{64}$/i.test(process.env.META_TOKEN_ENCRYPTION_KEY || "")
    ) {
      return res.status(503).json({
        success: false,
        message: "Facebook Lead Ads integration is not configured."
      });
    }

    res.json({
      success: true,
      appId: process.env.META_APP_ID
    });
  }
);

router.get(
  "/facebook-leads/status",
  authMiddleware,
  (req, res) => {
    const pages = req.workspaceOwner.facebookLeadAds?.pages || [];
    res.json({
      success: true,
      canConnect: hasPlanFeature(req.workspaceOwner.plan, "facebookLeadAds"),
      pages: pages.map(({ pageId, pageName, connectedAt }) => ({
        pageId,
        pageName,
        connectedAt
      }))
    });
  }
);

router.post(
  "/facebook-leads/pages",
  authMiddleware,
  requireLeadAdsPlan,
  async (req, res) => {
    try {
      const { accessToken } = req.body || {};
      if (
        typeof accessToken !== "string" ||
        accessToken.length < 20 ||
        accessToken.length > 4096
      ) {
        return res.status(400).json({
          success: false,
          message: "Facebook authorization is missing or invalid."
        });
      }

      const pages = await facebookLeadAdsService.listAvailablePages(accessToken);
      res.json({ success: true, pages });
    } catch (error) {
      console.error("Facebook Lead Ads page lookup failed:", error.message);
      res.status(400).json({
        success: false,
        message: error.message || "Could not load your Facebook Pages."
      });
    }
  }
);

router.post(
  "/facebook-leads/connect",
  authMiddleware,
  requireLeadAdsPlan,
  async (req, res) => {
    try {
      const { accessToken, pageIds } = req.body || {};
      if (
        typeof accessToken !== "string" ||
        accessToken.length < 20 ||
        accessToken.length > 4096
      ) {
        return res.status(400).json({
          success: false,
          message: "Facebook authorization is missing or invalid."
        });
      }

      const result = await facebookLeadAdsService.connectPages(
        accessToken,
        pageIds,
        req.workspaceOwner._id
      );
      res.json({
        success: true,
        message: result.failed.length
          ? `${result.connected.length} Page(s) connected; ${result.failed.length} could not be connected.`
          : "Facebook Lead Ads connected. New leads will appear in your Growble dashboard.",
        data: result
      });
    } catch (error) {
      console.error("Facebook Lead Ads connection failed:", error.message);
      res.status(400).json({
        success: false,
        message: error.message || "Could not connect Facebook Lead Ads."
      });
    }
  }
);

router.delete(
  "/facebook-leads/pages/:pageId",
  authMiddleware,
  async (req, res) => {
    try {
      await facebookLeadAdsService.disconnectPage(
        req.params.pageId,
        req.workspaceOwner._id
      );
      res.json({
        success: true,
        message: "Facebook Page disconnected."
      });
    } catch (error) {
      console.error("Facebook Lead Ads disconnection failed:", error.message);
      res.status(400).json({
        success: false,
        message: error.message || "Could not disconnect Facebook Page."
      });
    }
  }
);

router.get("/status", authMiddleware, requireWhatsAppPlan, (req, res) => {
  res.json({
    success: true,
    connected: req.workspaceOwner.whatsapp.connected,
    whatsapp: {
      connected: req.workspaceOwner.whatsapp.connected,
      phoneNumber: req.workspaceOwner.whatsapp.phoneNumber,
      displayName: req.workspaceOwner.whatsapp.displayName,
      connectedAt: req.workspaceOwner.whatsapp.connectedAt
    }
  });
});

router.post("/exchange-code", authMiddleware, requireWhatsAppPlan, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code is required."
      });
    }

    const result = await metaService.connectCustomer(
      code,
      req.workspaceOwner._id
    );

    return res.json({
      success: true,
      message: "WhatsApp connected successfully.",
      data: result
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message
    });

  }
});

module.exports = router;