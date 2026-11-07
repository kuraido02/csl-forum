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

async function sendPasswordResetEmail(userId, email, username) {
  const token = await createEmailToken(userId, "reset_password", 60); // valid 1 hour
  const link = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

  await sendEmail({
    to: email,
    subject: "Reset your CSL Forum password",
    text: `Hi ${username},\n\nWe received a request to reset your password. Open this link to choose a new one:\n${link}\n\nThe link expires in 1 hour. If you didn't ask for this, ignore this email and your password will stay the same.`,
    html: `
      <p>Hi ${username},</p>
      <p>We received a request to reset your password. Click the button below to choose a new one:</p>
      <p><a href="${link}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Reset password</a></p>
      <p>Or copy this link into your browser:<br>${link}</p>
      <p>The link expires in 1 hour. If you didn't ask for this, ignore this email and your password will stay the same.</p>
    `,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };