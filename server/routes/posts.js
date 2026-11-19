const express = require("express");
const multer = require("multer");
const { z } = require("zod");
const db = require("../db");
const requireAuth = require("../middleware/requireAuth");
const formatPost = require("../utils/formatPost");
const { POST_SELECT, findPostById, findLatestReviews } = require("../utils/posts");
const { formatReview } = formatPost;
const { findFullUserById } = require("../utils/users");
const { sendError, sendValidationError } = require("../utils/http");
const fs = require("fs");
const path = require("path");
const { detectImageType, postDir, removePostImage } = require("../utils/images");

const router = express.Router();

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

    // 5. Save the post and its image together, or neither.
    // status is not set here: the table default is 'pending'.
    const conn = await db.getConnection();
    let savedFile = null;
    try {
      await conn.beginTransaction();

      const [result] = await conn.query(
        `INSERT INTO posts (author_id, department_id, organization_id, title, body, link_url)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [author.id, departmentId, organizationId, title, body, linkUrl]
      );

      if (req.file) {
        // The file name starts with the post id, so it is easy to match later
        const filename = `${result.insertId}-${Date.now()}.${imageType}`;
        savedFile = path.join(postDir, filename);
        await fs.promises.writeFile(savedFile, req.file.buffer);
        await conn.query("UPDATE posts SET image_url = ? WHERE id = ?", [
          `/uploads/posts/${filename}`,
          result.insertId,
        ]);
      }

      await conn.commit();

      const row = await findPostById(result.insertId);
      res.status(201).json({ post: formatPost(row, { review: null }) });
    } catch (err) {
      await conn.rollback();
      // The database says "no post", so the file must not stay on disk either
      if (savedFile) fs.promises.unlink(savedFile).catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

const PAGE_SIZE = 20;

// The homepage list: approved posts from everyone, newest published first
router.get("/", requireAuth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const where = ["p.status = 'approved'", "p.deleted_at IS NULL"];
    const params = [];

    // Optional filter by organization code
    const code = req.query.organization;
    if (code !== undefined && code !== "") {
      const [orgRows] = await db.query("SELECT id FROM organizations WHERE code = ?", [
        String(code),
      ]);
      if (!orgRows[0]) {
        return sendError(res, 400, "VALIDATION_ERROR", "Please fix the highlighted fields.", {
          organization: "Unknown organization.",
        });
      }
      where.push("p.organization_id = ?");
      params.push(orgRows[0].id);
    }
    const whereSql = where.join(" AND ");

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM posts p WHERE ${whereSql}`,
      params
    );

    const [rows] = await db.query(
      `${POST_SELECT}
       WHERE ${whereSql}
       ORDER BY p.published_at DESC, p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]
    );

    res.json({
      items: rows.map((row) => formatPost(row, { summary: true })),
      page,
      pageSize: PAGE_SIZE,
      total,
    });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

const POST_STATUSES = ["pending", "approved", "rejected"];

// The author's own posts: every status, newest first, with the latest review
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const where = ["p.author_id = ?", "p.deleted_at IS NULL"];
    const params = [req.user.id];

    // Optional filter by status
    const status = req.query.status;
    if (status !== undefined && status !== "") {
      if (!POST_STATUSES.includes(status)) {
        return sendError(res, 400, "VALIDATION_ERROR", "Please fix the highlighted fields.", {
          status: "Use pending, approved or rejected.",
        });
      }
      where.push("p.status = ?");
      params.push(status);
    }
    const whereSql = where.join(" AND ");

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM posts p WHERE ${whereSql}`,
      params
    );

    const [rows] = await db.query(
      `${POST_SELECT}
       WHERE ${whereSql}
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]
    );

    // One query for the latest review of every post on this page
    const reviews = await findLatestReviews(rows.map((row) => row.id));

    res.json({
      items: rows.map((row) =>
        formatPost(row, { summary: true, review: formatReview(reviews.get(row.id)) })
      ),
      page,
      pageSize: PAGE_SIZE,
      total,
    });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

// One post. Visibility rules: see "Who can see a post" in the contract.
router.get("/:id", requireAuth, async (req, res) => {
  try {
    // The id must be a plain number, otherwise there is no such post
    if (!/^\d+$/.test(req.params.id)) {
      return sendError(res, 404, "NOT_FOUND", "Post not found.");
    }

    const row = await findPostById(Number(req.params.id));
    if (!row) return sendError(res, 404, "NOT_FOUND", "Post not found.");

    const viewer = await findFullUserById(req.user.id);
    if (!viewer) return sendError(res, 401, "UNAUTHENTICATED", "Please log in.");

    const isAuthor = viewer.id === row.author_id;
    const isAdmin = viewer.role === "admin";
    // A moderator only counts for posts of THEIR department
    const isModerator = viewer.moderator_department_id === row.department_id;
    const isStaff = isAdmin || isModerator;

    // pending and rejected posts: author, department moderators and admins only.
    // Everyone else gets 404, so they can't even tell the post exists.
    if (row.status !== "approved" && !isAuthor && !isStaff) {
      return sendError(res, 404, "NOT_FOUND", "Post not found.");
    }

    const extras = {};

    // The latest review is for the author and the staff; only staff see who decided
    if (isAuthor || isStaff) {
      const reviews = await findLatestReviews([row.id]);
      extras.review = formatReview(reviews.get(row.id), { includeModerator: isStaff });
    }

    // The responsible department is for the staff only
    if (isStaff) {
      const [deptRows] = await db.query(
        "SELECT id, code, name FROM departments WHERE id = ?",
        [row.department_id]
      );
      extras.department = deptRows[0];
    }

    res.json({ post: formatPost(row, extras) });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

// Loads a post for author-only actions (edit and delete).
// Returns the post row, or sends the right error and returns null.
async function loadOwnPost(req, res) {
  if (!/^\d+$/.test(req.params.id)) {
    sendError(res, 404, "NOT_FOUND", "Post not found.");
    return null;
  }

  const row = await findPostById(Number(req.params.id));
  if (!row) {
    sendError(res, 404, "NOT_FOUND", "Post not found.");
    return null;
  }

  if (row.author_id === req.user.id) return row;

  // Not the author. If they are allowed to SEE the post it is 403;
  // if they are not, we pretend it does not exist (404).
  let canSee = row.status === "approved";
  if (!canSee) {
    const viewer = await findFullUserById(req.user.id);
    canSee =
      Boolean(viewer) &&
      (viewer.role === "admin" || viewer.moderator_department_id === row.department_id);
  }

  if (canSee) {
    sendError(res, 403, "FORBIDDEN", "You can only change your own posts.");
  } else {
    sendError(res, 404, "NOT_FOUND", "Post not found.");
  }
  return null;
}

// Every field is optional: send only what you want to change
const updatePostSchema = z.object({
  title: z.string().trim().min(1, "Required.").max(200, "Up to 200 characters.").optional(),
  organizationId: z.coerce
    .number("Choose an organization.")
    .int("Choose an organization.")
    .positive("Choose an organization.")
    .optional(),
  body: optionalText(10000),
  linkUrl: linkUrlRule,
  removeImage: z
    .string()
    .refine((value) => value === "true" || value === "false", "Use true or false.")
    .optional(),
});

router.patch("/:id", requireAuth, readPostForm, async (req, res) => {
  try {
    // 1. Is it the author's own post?
    const row = await loadOwnPost(req, res);
    if (!row) return;

    // 2. The same posting rules as creating a post
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

    // 3. Validate the fields that were sent
    const parsed = updatePostSchema.safeParse(req.body ?? {});
    if (!parsed.success) return sendValidationError(res, parsed.error);
    const { title, organizationId, body, linkUrl, removeImage } = parsed.data;

    const hasChange =
      title !== undefined ||
      organizationId !== undefined ||
      body !== undefined ||
      linkUrl !== undefined ||
      removeImage === "true" ||
      Boolean(req.file);
    if (!hasChange) {
      return sendError(res, 400, "VALIDATION_ERROR", "Nothing to update.");
    }

    // 4. A new image must really be an image
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

    // 5. A new organization tag must be one of the real five
    if (organizationId !== undefined) {
      const [orgRows] = await db.query("SELECT id FROM organizations WHERE id = ?", [
        organizationId,
      ]);
      if (!orgRows[0]) {
        return sendError(res, 400, "VALIDATION_ERROR", "Please fix the highlighted fields.", {
          organizationId: "Choose a valid organization.",
        });
      }
    }

    // 6. What will the post look like AFTER the edit?
    //    (a field that was not sent keeps its current value)
    const finalTitle = title !== undefined ? title : row.title;
    const finalBody = body !== undefined ? body : row.body;
    const finalLink = linkUrl !== undefined ? linkUrl : row.link_url;
    const finalOrganizationId = organizationId !== undefined ? organizationId : row.org_id;

    let finalImageUrl = row.image_url;
    if (removeImage === "true") finalImageUrl = null;

    // The post must still have some content
    if (!finalBody && !finalLink && !finalImageUrl && !req.file) {
      return sendError(res, 400, "VALIDATION_ERROR", "Please fix the highlighted fields.", {
        body: "A post needs text, a link or an image.",
      });
    }

    // 7. The moderating department is decided AGAIN from the author's course now
    const [courseRows] = await db.query("SELECT department_id FROM courses WHERE id = ?", [
      author.course_id,
    ]);
    const departmentId = courseRows[0].department_id;

    // 8. Save everything together, or nothing
    const conn = await db.getConnection();
    let newFile = null;
    try {
      await conn.beginTransaction();

      if (req.file) {
        const filename = `${row.id}-${Date.now()}.${imageType}`;
        newFile = path.join(postDir, filename);
        await fs.promises.writeFile(newFile, req.file.buffer);
        finalImageUrl = `/uploads/posts/${filename}`;
      }

      await conn.query(
        `UPDATE posts
         SET title = ?, body = ?, link_url = ?, organization_id = ?,
             image_url = ?, department_id = ?, status = 'pending'
         WHERE id = ?`,
        [
          finalTitle,
          finalBody,
          finalLink,
          finalOrganizationId,
          finalImageUrl,
          departmentId,
          row.id,
        ]
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      if (newFile) fs.promises.unlink(newFile).catch(() => {});
      throw err;
    } finally {
      conn.release();
    }

    // The save worked, so the old image file is not needed any more
    if (finalImageUrl !== row.image_url) removePostImage(row.image_url);

    // 9. Send back the updated post with its latest review (if any)
    const updated = await findPostById(row.id);
    const reviews = await findLatestReviews([row.id]);
    res.json({ post: formatPost(updated, { review: formatReview(reviews.get(row.id)) }) });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const row = await loadOwnPost(req, res);
    if (!row) return;

    // Soft delete: the record stays, but nobody can see the post any more
    await db.query("UPDATE posts SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL", [
      row.id,
    ]);

    // The image file is not needed any more
    removePostImage(row.image_url);

    res.status(204).send();
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

module.exports = router;