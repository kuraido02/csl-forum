const express = require("express");
const { z } = require("zod");
const db = require("../db");
const requireAuth = require("../middleware/requireAuth");
const formatUser = require("../utils/formatUser");
const { findFullUserById } = require("../utils/users");
const { sendError, sendValidationError } = require("../utils/http");

const router = express.Router();

// Text field: trims spaces, limits length, and turns "" into null (clears the field)
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max, `Up to ${max} characters.`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Required.").max(50, "Up to 50 characters.").optional(),
  bio: optionalText(500),
  program: optionalText(50),
  schoolIdNumber: optionalText(30),
  yearLevel: z
    .number("Must be a number.")
    .int("Must be a whole number.")
    .min(1, "Must be 1 to 4.")
    .max(4, "Must be 1 to 4.")
    .nullable()
    .optional(),
});

// Which request field maps to which database column
const profileColumns = {
  displayName: "display_name",
  bio: "bio",
  program: "program",
  schoolIdNumber: "school_id_number",
  yearLevel: "year_level",
};

router.patch("/me", requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  // Build "column = ?" only for the fields the client actually sent
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(profileColumns)) {
    if (parsed.data[key] !== undefined) {
      sets.push(`${column} = ?`);
      values.push(parsed.data[key]);
    }
  }

  if (sets.length === 0) {
    return sendError(res, 400, "VALIDATION_ERROR", "Nothing to update.");
  }

  try {
    await db.query(`UPDATE profiles SET ${sets.join(", ")} WHERE user_id = ?`, [
      ...values,
      req.user.id,
    ]);

    const user = await findFullUserById(req.user.id);
    if (!user) return sendError(res, 401, "UNAUTHENTICATED", "Please log in.");

    res.json({ user: formatUser(user) });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return sendError(res, 409, "CONFLICT", "School ID is already used.", {
        schoolIdNumber: "School ID is already used.",
      });
    }
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

router.get("/:username", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.username, u.role, u.school_verified_at, u.created_at,
              p.display_name, p.bio, p.avatar_url, p.program, p.year_level
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.username = ?
         AND u.status <> 'deleted'
         AND u.email_verified_at IS NOT NULL
       LIMIT 1`,
      [req.params.username]
    );
    const row = rows[0];
    if (!row) return sendError(res, 404, "NOT_FOUND", "User not found.");

    res.json({
      user: {
        id: row.id,
        username: row.username,
        role: row.role,
        schoolVerified: row.school_verified_at !== null,
        createdAt: row.created_at,
        profile: {
          displayName: row.display_name,
          bio: row.bio,
          avatarUrl: row.avatar_url,
          program: row.program,
          yearLevel: row.year_level,
        },
      },
    });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

module.exports = router;