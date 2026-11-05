const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const db = require("../db");
const jwt = require("jsonwebtoken");
const formatUser = require("../utils/formatUser");
const { sendError, sendValidationError } = require("../utils/http");

const router = express.Router();

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
};

// Rules for the data we accept (matches docs/api-contract.md)
const registerSchema = z.object({
  username: z
    .string()
    .regex(/^[a-zA-Z0-9_]{3,30}$/, "3-30 characters: letters, numbers, underscore only."),
  email: z.string().email("Enter a valid email.").max(255),
  password: z
    .string()
    .min(8, "At least 8 characters.")
    .regex(/[A-Za-z]/, "Needs at least one letter.")
    .regex(/[0-9]/, "Needs at least one number."),
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

module.exports = router;