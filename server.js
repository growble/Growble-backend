const startAutomationCron = require("./cron/automationCron");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();

/* 🔹 ROUTES */
const usageRoutes = require("./routes/usageRoutes");
const adminRoutes = require("./routes/adminRoutes");
const authRoutes = require("./routes/authRoutes");
const leadRoutes = require("./routes/leadRoutes");
const paymentRoutes = require("./routes/payment.routes");
const razorpayWebhookRoutes = require("./routes/razorpayWebhook.routes");
const userRoutes = require("./routes/user.routes");

/* 🔹 MIDDLEWARES */
const authMiddleware = require("./middleware/authMiddleware");
const startFollowUpScheduler = require("./services/followUpScheduler");

const app = express();

/* 🔹 GLOBAL MIDDLEWARE */
app.use(cors());

/* 🔹 HEALTH CHECK */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landing.html"));
});

/* 🔹 STATIC FILES (PAYMENT PAGE) */
app.use(express.static("public"));

app.get("/payment", (req, res) => {
  res.sendFile(path.join(__dirname, "public/payment.html"));
});

/* 🔹 RAZORPAY WEBHOOK (RAW BODY) */
app.use("/api/webhook", razorpayWebhookRoutes);

/* 🔹 JSON FOR REST APIS */
app.use(express.json());

/* 🔹 ADMIN PANEL STATIC */
app.use("/admin-panel", express.static("admin"));

/* 🔹 ROUTES */
app.use("/api/auth", authRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/usage", usageRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/user", userRoutes);

/* 🔹 PROTECTED TEST ROUTE */
app.get("/api/protected", authMiddleware, (req, res) => {
  res.json({
    message: "You are authorized",
    user: req.user
  });
});

/* 🔹 DATABASE + SCHEDULER */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully");
    startFollowUpScheduler();
  })
  .catch((err) => {
    console.error("MongoDB connection failed ❌", err);
  });
app.get("/health", (req, res) => {
  res.status(200).send("Growble server running");
});

/* 🔹 START SERVER */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
