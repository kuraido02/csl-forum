const crypto = require("crypto");
const db = require("../db");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function createEmailToken(userId, type, minutesValid) {
  // Cancel older unused tokens of the same type, so only the newest link works
  await db.query(
    "UPDATE email_tokens SET used_at = NOW() WHERE user_id = ? AND type = ? AND used_at IS NULL",
    [userId, type]
  );

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  await db.query(
    `INSERT INTO email_tokens (user_id, type, token_hash, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [userId, type, tokenHash, minutesValid]
  );

  return token; // the raw token goes in the email; only the hash is stored
}

module.exports = { hashToken, createEmailToken };