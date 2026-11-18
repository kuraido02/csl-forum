const express = require("express");
const multer = require("multer");
const { z } = require("zod");
const db = require("../db");
const requireAuth = require("../middleware/requireAuth");
const formatPost = require("../utils/formatPost");
const { findPostById } = require("../utils/posts");
const { findFullUserById } = require("../utils/users");
const { sendError, sendValidationError } = require("../utils/http");
const fs = require("fs");
const path = require("path");
const { detectImageType } = require("../utils/images");

const router = express.Router();

// Where post images are stored: server/uploads/posts
const postDir = path.join(__dirname, "..", "uploads", "posts");
fs.mkdirSync(postDir, { recursive: true });

// Keep the upload in memory (max 5 MB, one file) so we can check it before saving
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

// Reads the text fields AND the one optional file named "image".
// Multer errors are reported in our JSON error format.
function readPostForm(req, res, next) {
  upload.single("image")(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "Image must be 5 MB or smaller."
          : "Upload one image in the field named 'image'.";
      return sendError(res, 400, "VALIDATION_ERROR", message, { image: message });
    }
    next(err);
  });
}

// Text field: trims spaces, limits length, and turns "" into null
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max, `Up to ${max} characters.`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

// A link must be a full http:// or https:// address
function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const linkUrlRule = z
  .string()
  .trim()
  .max(2048, "Up to 2048 characters.")
  .refine(
    (value) => value === "" || isHttpUrl(value),
    "Enter a full link starting with http:// or https://"
  )
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

const createPostSchema = z.object({
  title: z.string("Required.").trim().min(1, "Required.").max(200, "Up to 200 characters."),
  // Form fields always arrive as text, so "5" must become the number 5
  organizationId: z.coerce
    .number("Choose an organization.")
    .int("Choose an organization.")
    .positive("Choose an organization."),
  body: optionalText(10000),
  linkUrl: linkUrlRule,
});

router.post("/", requireAuth, readPostForm, async (req, res) => {
  try {
    // 1. Who is posting? Check the posting rules before anything else
    const author = await findFullUserById(req.user.id);
    if (!author) return sendError(res, 401, "UNAUTHENTICATED", "Please log in.");

    if (!author.school_verified_at) {
      return sendError(
        res,
        403,
        "SCHOOL_NOT_VERIFIED",
        "Your school ID must be verified before you can post."
      );
    }
    if (!author.course_id) {
      return sendError(
        res,
        403,
        "PROFILE_INCOMPLETE",
        "Choose your course in your profile before posting."
      );
    }

    // 2. Validate the form fields
    const parsed = createPostSchema.safeParse(req.body ?? {});
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const { title, organizationId } = parsed.data;
    const body = parsed.data.body ?? null;
    const linkUrl = parsed.data.linkUrl ?? null;

        // A post needs some content: text, a link, or an image
    if (!body && !linkUrl && !req.file) {
      return sendError(res, 400, "VALIDATION_ERROR", "Please fix the highlighted fields.", {
        body: "Add some text, a link or an image.",
      });
    }

    // If there is an image, check what it REALLY is (first bytes, not the file name)
    let imageType = null;
    if (req.file) {
      imageType = detectImageType(req.file.buffer);
      if (!imageType) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "Only JPEG, PNG or WebP images are allowed.",
          { image: "Only JPEG, PNG or WebP images are allowed." }
        );
      }
    }

    // 3. The organization tag must be one of the real five
    const [orgRows] = await db.query("SELECT id FROM organizations WHERE id = ?", [
      organizationId,
    ]);
    if (!orgRows[0]) {
      return sendError(res, 400, "VALIDATION_ERROR", "Please fix the highlighted fields.", {
        organizationId: "Choose a valid organization.",
      });
    }

    // 4. The moderating department comes from the AUTHOR'S COURSE.
    //    Never from the organization tag, never from the client.
    const [courseRows] = await db.query("SELECT department_id FROM courses WHERE id = ?", [
      author.course_id,
    ]);
    const departmentId = courseRows[0].department_id;

    // 5. Save it. status is not set here: the table default is 'pending'.
    const [result] = await db.query(
      `INSERT INTO posts (author_id, department_id, organization_id, title, body, link_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [author.id, departmentId, organizationId, title, body, linkUrl]
    );

    const row = await findPostById(result.insertId);
    res.status(201).json({ post: formatPost(row, { review: null }) });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

module.exports = router;