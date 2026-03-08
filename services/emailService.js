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

module.exports = sendFollowUpEmail;