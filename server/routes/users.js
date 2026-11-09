const express = require("express");
const { z } = require("zod");
const db = require("../db");
const requireAuth = require("../middleware/requireAuth");
const formatUser = require("../utils/formatUser");
const { findFullUserById } = require("../utils/users");
const { sendError, sendValidationError } = require("../utils/http");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { cookieOptions } = require("../utils/cookies");

const router = express.Router();

// Where avatars are stored: server/uploads/avatars
const avatarDir = path.join(__dirname, "..", "uploads", "avatars");
fs.mkdirSync(avatarDir, { recursive: true });

// Keep the upload in memory (max 2 MB, one file) so we can check it before saving
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

// Look at the first bytes of the file to find out what it REALLY is.
// Never trust the file name or the type the browser claims.
function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  const pngStart = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(pngStart)) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

// Delete an old avatar file from disk (ignore errors if it's already gone)
function removeAvatarFile(avatarUrl) {
  if (!avatarUrl) return;
  const file = path.join(avatarDir, path.basename(avatarUrl));
  fs.promises.unlink(file).catch(() => {});
}

// Run multer, but report its errors in our JSON error format
function uploadAvatar(req, res, next) {
  upload.single("avatar")(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "Image must be 2 MB or smaller."
          : "Upload one file in the field named 'avatar'.";
      return sendError(res, 400, "VALIDATION_ERROR", message, { avatar: message });
    }
    next(err);
  });
}

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

router.post("/me/avatar", requireAuth, uploadAvatar, async (req, res) => {
  if (!req.file) {
    return sendError(res, 400, "VALIDATION_ERROR", "Choose an image to upload.", {
      avatar: "Choose an image to upload.",
    });
  }

  const type = detectImageType(req.file.buffer);
  if (!type) {
    return sendError(res, 400, "VALIDATION_ERROR", "Only JPEG, PNG or WebP images are allowed.", {
      avatar: "Only JPEG, PNG or WebP images are allowed.",
    });
  }

  const filename = `${req.user.id}-${Date.now()}.${type}`;
  const avatarUrl = `/uploads/avatars/${filename}`;

  try {
    const [rows] = await db.query("SELECT avatar_url FROM profiles WHERE user_id = ?", [
      req.user.id,
    ]);
    const oldUrl = rows[0]?.avatar_url;

    await fs.promises.writeFile(path.join(avatarDir, filename), req.file.buffer);
    await db.query("UPDATE profiles SET avatar_url = ? WHERE user_id = ?", [
      avatarUrl,
      req.user.id,
    ]);

    removeAvatarFile(oldUrl);
    res.json({ avatarUrl });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

router.delete("/me/avatar", requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT avatar_url FROM profiles WHERE user_id = ?", [
      req.user.id,
    ]);
    await db.query("UPDATE profiles SET avatar_url = NULL WHERE user_id = ?", [req.user.id]);

    removeAvatarFile(rows[0]?.avatar_url);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Required."),
});

router.delete("/me", requireAuth, async (req, res) => {
  const parsed = deleteAccountSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  let conn;
  try {
    const [rows] = await db.query(
      `SELECT u.password_hash, u.role, p.avatar_url
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id = ? AND u.status = 'active'`,
      [req.user.id]
    );
    const user = rows[0];
    if (!user) return sendError(res, 401, "UNAUTHENTICATED", "Please log in.");

    if (user.role === "admin") {
      return sendError(res, 403, "FORBIDDEN", "Admin accounts can't be deleted here.");
    }

    const passwordOk = await bcrypt.compare(parsed.data.password, user.password_hash);
    if (!passwordOk) {
      return sendError(res, 400, "VALIDATION_ERROR", "Please fix the highlighted fields.", {
        password: "Password is incorrect.",
      });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    await conn.query(
      `UPDATE users
       SET status = 'deleted', deleted_at = NOW(), username = ?, email = ?
       WHERE id = ?`,
      [`deleted_${req.user.id}`, `deleted_${req.user.id}@deleted.local`, req.user.id]
    );
    await conn.query(
      `UPDATE profiles
       SET display_name = '[deleted]', bio = NULL, avatar_url = NULL,
           school_id_number = NULL, program = NULL, year_level = NULL
       WHERE user_id = ?`,
      [req.user.id]
    );
    await conn.query("DELETE FROM email_tokens WHERE user_id = ?", [req.user.id]);

    await conn.commit();

    removeAvatarFile(user.avatar_url);
    res.clearCookie("token", cookieOptions);
    res.status(204).send();
  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  } finally {
    if (conn) conn.release();
  }
});

async function sendEmptyList(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT id FROM users
       WHERE username = ? AND status <> 'deleted' AND email_verified_at IS NOT NULL
       LIMIT 1`,
      [req.params.username]
    );
    if (!rows[0]) return sendError(res, 404, "NOT_FOUND", "User not found.");

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    res.json({ items: [], page, pageSize: 20, total: 0 });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
}

router.get("/:username/posts", sendEmptyList);
router.get("/:username/comments", sendEmptyList);

module.exports = router;