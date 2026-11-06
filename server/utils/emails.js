const { sendEmail } = require("./mailer");
const { createEmailToken } = require("./tokens");

async function sendVerificationEmail(userId, email, username) {
  const token = await createEmailToken(userId, "verify_email", 60 * 24); // valid 24 hours
  const link = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

  await sendEmail({
    to: email,
    subject: "Verify your CSL Forum email",
    text: `Hi ${username},\n\nVerify your email by opening this link:\n${link}\n\nThe link expires in 24 hours. If you didn't create an account, ignore this email.`,
    html: `
      <p>Hi ${username},</p>
      <p>Verify your email by clicking the button below:</p>
      <p><a href="${link}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Verify email</a></p>
      <p>Or copy this link into your browser:<br>${link}</p>
      <p>The link expires in 24 hours. If you didn't create an account, ignore this email.</p>
    `,
  });
}

module.exports = { sendVerificationEmail };