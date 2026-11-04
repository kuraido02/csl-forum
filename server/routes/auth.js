const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const db = require("../db");

const router = express.Router();

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

module.exports = router;