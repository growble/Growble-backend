const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendFollowUpEmail(to, lead) {
  const mailOptions = {
    from: `"Growble CRM" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Follow-up Reminder: ${lead.name}`,
    html: `
      <h3>📌 Follow-up Reminder</h3>
      <p>You have a follow-up scheduled for:</p>
      <ul>
        <li><strong>Name:</strong> ${lead.name}</li>
        <li><strong>Phone:</strong> ${lead.phone}</li>
        <li><strong>Status:</strong> ${lead.status}</li>
      </ul>
      <p>Please contact this lead today.</p>
      <br/>
      <small>Sent by Growble CRM</small>
    `
  };

  await transporter.sendMail(mailOptions);
}

async function sendPasswordResetEmail(to, resetUrl) {
  const mailOptions = {
    from: `"Growble" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Reset your Growble password",
    text: `We received a request to reset your Growble password. Use this link within 1 hour:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:560px;margin:auto">
        <h2 style="color:#008eaa">Reset your Growble password</h2>
        <p>We received a request to reset your password. This link expires in 1 hour.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#00d4ff;color:#06131b;text-decoration:none;font-weight:bold">Choose a new password</a></p>
        <p>If the button does not work, copy this link into your browser:</p>
        <p style="word-break:break-all">${resetUrl}</p>
        <p>If you did not request a password reset, you can ignore this email.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

sendFollowUpEmail.sendPasswordResetEmail = sendPasswordResetEmail;
sendFollowUpEmail.isConfigured = () =>
  Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

module.exports = sendFollowUpEmail;