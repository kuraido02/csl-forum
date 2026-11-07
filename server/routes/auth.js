const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const db = require("../db");
const jwt = require("jsonwebtoken");
const formatUser = require("../utils/formatUser");
const { sendError, sendValidationError } = require("../utils/http");
const requireAuth = require("../middleware/requireAuth");
const { hashToken } = require("../utils/tokens");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../utils/emails");

const router = express.Router();

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
};

const passwordRule = z
  .string()
  .min(8, "At least 8 characters.")
  .regex(/[A-Za-z]/, "Needs at least one letter.")
  .regex(/[0-9]/, "Needs at least one number.");

// Rules for the data we accept (matches docs/api-contract.md)
const registerSchema = z.object({
  username: z
    .string()
    .regex(/^[a-zA-Z0-9_]{3,30}$/, "3-30 characters: letters, numbers, underscore only."),
  email: z.string().email("Enter a valid email.").max(255),
    password: passwordRule,
  displayName: z.string().trim().min(1, "Required.").max(50),
  role: z.enum(["student", "teacher"]),
});

router.post("/register", async (req, res) => {
  // 1. Validate the input
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const fields = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (!fields[key]) fields[key] = issue.message;
    }
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Please fix the highlighted fields.",
        fields,
      },
    });
  }

  const { username, email, password, displayName, role } = parsed.data;

  // 2. Save to the database (users + profiles together, or neither)
  const conn = await db.getConnection();
  try {
    const passwordHash = await bcrypt.hash(password, 10);

    await conn.beginTransaction();
    const [result] = await conn.query(
      "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [username, email.toLowerCase(), passwordHash, role]
    );
    await conn.query(
      "INSERT INTO profiles (user_id, display_name) VALUES (?, ?)",
      [result.insertId, displayName]
    );
    await conn.commit();

    // Email the verification link. If sending fails the account still exists
    // and the user can request a new link with "resend".
    sendVerificationEmail(result.insertId, email.toLowerCase(), username).catch((err) =>
      console.error("Verification email failed:", err)
    );

    // 3. Send back the new user (never send the password hash)
    res.status(201).json({
      user: {
        id: result.insertId,
        username,
        email: email.toLowerCase(),
        role,
        status: "active",
        emailVerified: false,
        schoolVerified: false,
        createdAt: new Date().toISOString(),
        profile: {
          displayName,
          bio: null,
          avatarUrl: null,
          schoolIdNumber: null,
          program: null,
          yearLevel: null,
        },
      },
    });
  } catch (err) {
    await conn.rollback();

    // Username or email already exists
    if (err.code === "ER_DUP_ENTRY") {
      const field = err.message.includes("uq_users_email") ? "email" : "username";
      const label = field === "email" ? "Email" : "Username";
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: `${label} is already used.`,
          fields: { [field]: `${label} is already used.` },
        },
      });
    }

    console.error(err);
    res.status(500).json({
      error: { code: "SERVER_ERROR", message: "Something went wrong." },
    });
  } finally {
    conn.release();
  }
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Required."),
  password: z.string().min(1, "Required."),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const { identifier, password } = parsed.data;

  try {
    // identifier can be the username OR the email; deleted accounts are skipped
    const [rows] = await db.query(
      `SELECT u.*, p.display_name, p.bio, p.avatar_url,
              p.school_id_number, p.program, p.year_level
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE (u.username = ? OR u.email = ?) AND u.status <> 'deleted'
       LIMIT 1`,
      [identifier, identifier.toLowerCase()]
    );
    const user = rows[0];

    // Same message whether the user or the password is wrong,
    // so nobody can use this to find out which usernames exist
    const passwordOk = user && (await bcrypt.compare(password, user.password_hash));
    if (!passwordOk) {
      return sendError(res, 401, "UNAUTHENTICATED", "Invalid username or password.");
    }

    if (user.status === "banned") {
      return sendError(res, 403, "ACCOUNT_BANNED", "This account is banned.");
    }
    if (!user.email_verified_at) {
      return sendError(res, 403, "EMAIL_NOT_VERIFIED", "Please verify your email first.");
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

res.cookie("token", token, {
  ...cookieOptions,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
});

res.json({ user: formatUser(user) });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", cookieOptions);
  res.status(204).send();
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.*, p.display_name, p.bio, p.avatar_url,
              p.school_id_number, p.program, p.year_level
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id = ? AND u.status = 'active'
       LIMIT 1`,
      [req.user.id]
    );
    const user = rows[0];

    if (!user) {
      res.clearCookie("token", cookieOptions);
      return sendError(res, 401, "UNAUTHENTICATED", "Please log in.");
    }

    res.json({ user: formatUser(user) });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token is required."),
});

router.post("/verify-email", async (req, res) => {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const tokenHash = hashToken(parsed.data.token);

  try {
    const [rows] = await db.query(
      `SELECT id, user_id FROM email_tokens
       WHERE token_hash = ? AND type = 'verify_email'
         AND used_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );
    const record = rows[0];
    if (!record) {
      return sendError(res, 410, "TOKEN_INVALID", "This link is invalid or has expired.");
    }

    // Mark the token as used. If another request used it first, stop.
    const [marked] = await db.query(
      "UPDATE email_tokens SET used_at = NOW() WHERE id = ? AND used_at IS NULL",
      [record.id]
    );
    if (marked.affectedRows === 0) {
      return sendError(res, 410, "TOKEN_INVALID", "This link is invalid or has expired.");
    }

    await db.query(
      "UPDATE users SET email_verified_at = NOW() WHERE id = ? AND email_verified_at IS NULL",
      [record.user_id]
    );

    res.json({ message: "Email verified." });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

const resendSchema = z.object({
  email: z.string().email("Enter a valid email."),
});

router.post("/resend-verification", async (req, res) => {
  const parsed = resendSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  try {
    const [rows] = await db.query(
      `SELECT id, username, email FROM users
       WHERE email = ? AND email_verified_at IS NULL AND status = 'active'
       LIMIT 1`,
      [parsed.data.email.toLowerCase()]
    );
    const user = rows[0];

    if (user) {
      sendVerificationEmail(user.id, user.email, user.username).catch((err) =>
        console.error("Verification email failed:", err)
      );
    }

    // Same answer whether or not the account exists, so nobody can use this
    // endpoint to find out which emails are registered.
    res.json({ message: "If the account exists, a new link was sent." });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email."),
});

router.post("/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  try {
    const [rows] = await db.query(
      "SELECT id, username, email FROM users WHERE email = ? AND status = 'active' LIMIT 1",
      [parsed.data.email.toLowerCase()]
    );
    const user = rows[0];

    if (user) {
      sendPasswordResetEmail(user.id, user.email, user.username).catch((err) =>
        console.error("Password reset email failed:", err)
      );
    }

    // Same answer whether or not the account exists
    res.json({ message: "If the account exists, a reset link was sent." });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required."),
  newPassword: passwordRule,
});

router.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const { token, newPassword } = parsed.data;
  const tokenHash = hashToken(token);

  let conn;
  try {
    // 1. Find a valid, unused, unexpired reset token
    const [rows] = await db.query(
      `SELECT id, user_id FROM email_tokens
       WHERE token_hash = ? AND type = 'reset_password'
         AND used_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );
    const record = rows[0];
    if (!record) {
      return sendError(res, 410, "TOKEN_INVALID", "This link is invalid or has expired.");
    }

    // 2. Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // 3. Use the token and save the password together, or neither
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [claimed] = await conn.query(
      "UPDATE email_tokens SET used_at = NOW() WHERE id = ? AND used_at IS NULL",
      [record.id]
    );
    if (claimed.affectedRows === 0) {
      await conn.rollback();
      return sendError(res, 410, "TOKEN_INVALID", "This link is invalid or has expired.");
    }

    await conn.query("UPDATE users SET password_hash = ? WHERE id = ?", [
      passwordHash,
      record.user_id,
    ]);

    // Cancel any other reset links still open for this user
    await conn.query(
      "UPDATE email_tokens SET used_at = NOW() WHERE user_id = ? AND type = 'reset_password' AND used_at IS NULL",
      [record.user_id]
    );

    await conn.commit();
    res.json({ message: "Password updated." });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;