const express = require("express");
const db = require("../db");
const requireAuth = require("../middleware/requireAuth");
const requireModerator = require("../middleware/requireModerator");
const formatPost = require("../utils/formatPost");
const { formatReview } = formatPost;
const {
  POST_SELECT,
  findPostById,
  findLatestReviews,
  findDepartmentsById,
} = require("../utils/posts");
const { z } = require("zod");
const { sendError, sendValidationError } = require("../utils/http");

const router = express.Router();

const PAGE_SIZE = 20;
const POST_STATUSES = ["pending", "approved", "rejected"];

// Loads the post for a moderator route, or sends the right error and returns null.
// A moderator can only reach posts of THEIR department; for any other post we
// answer 404, so they can't tell it exists. Admins can reach every department.
async function loadPostForModerator(req, res) {
  // The id must be a plain number, otherwise there is no such post
  if (!/^\d+$/.test(req.params.id)) {
    sendError(res, 404, "NOT_FOUND", "Post not found.");
    return null;
  }

  // findPostById already skips deleted posts
  const row = await findPostById(Number(req.params.id));
  if (!row) {
    sendError(res, 404, "NOT_FOUND", "Post not found.");
    return null;
  }

  if (!req.moderator.isAdmin && row.department_id !== req.moderator.departmentId) {
    sendError(res, 404, "NOT_FOUND", "Post not found.");
    return null;
  }

  return row;
}

// The moderation queue. Moderators see their own department only; admins see all.
router.get("/posts", requireAuth, requireModerator, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    // status defaults to "pending"
    const status =
      req.query.status === undefined || req.query.status === "" ? "pending" : req.query.status;
    if (!POST_STATUSES.includes(status)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Please fix the highlighted fields.", {
        status: "Use pending, approved or rejected.",
      });
    }

    const where = ["p.status = ?", "p.deleted_at IS NULL"];
    const params = [status];

    if (req.moderator.isAdmin) {
      // Admins see every department and may filter by department code
      const code = req.query.department;
      if (code !== undefined && code !== "") {
        const [deptRows] = await db.query("SELECT id FROM departments WHERE code = ?", [
          String(code),
        ]);
        if (!deptRows[0]) {
          return sendError(res, 400, "VALIDATION_ERROR", "Please fix the highlighted fields.", {
            department: "Unknown department.",
          });
        }
        where.push("p.department_id = ?");
        params.push(deptRows[0].id);
      }
    } else {
      // A moderator ONLY sees posts routed to their own department.
      // The department comes from the database, never from the request.
      where.push("p.department_id = ?");
      params.push(req.moderator.departmentId);
    }
    const whereSql = where.join(" AND ");

    // Pending: oldest first (first come, first served). Others: latest decision first.
    const orderSql =
      status === "pending" ? "p.created_at ASC, p.id ASC" : "p.updated_at DESC, p.id DESC";

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM posts p WHERE ${whereSql}`,
      params
    );

    const [rows] = await db.query(
      `${POST_SELECT}
       WHERE ${whereSql}
       ORDER BY ${orderSql}
       LIMIT ? OFFSET ?`,
      [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]
    );

    const reviews = await findLatestReviews(rows.map((row) => row.id));
    const departments = await findDepartmentsById();

    res.json({
      items: rows.map((row) =>
        formatPost(row, {
          summary: true,
          department: departments.get(row.department_id),
          review: formatReview(reviews.get(row.id), { includeModerator: true }),
        })
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

// One post for a moderator: the full post with department and latest review.
// Any status can be opened (pending, approved or rejected).
router.get("/posts/:id", requireAuth, requireModerator, async (req, res) => {
  try {
    const row = await loadPostForModerator(req, res);
    if (!row) return;

    const reviews = await findLatestReviews([row.id]);
    const departments = await findDepartmentsById();

    res.json({
      post: formatPost(row, {
        department: departments.get(row.department_id),
        review: formatReview(reviews.get(row.id), { includeModerator: true }),
      }),
    });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

// What a moderator may send. The note is optional; "" becomes null.
const decisionSchema = z.object({
  decision: z.enum(["approved", "rejected"], "Use approved or rejected."),
  organizationId: z
    .number("Choose an organization.")
    .int("Choose an organization.")
    .positive("Choose an organization.")
    .optional(),
  note: z
    .string()
    .trim()
    .max(500, "Up to 500 characters.")
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional(),
});

router.patch("/posts/:id", requireAuth, requireModerator, async (req, res) => {
  try {
    // 1. Can this moderator reach the post at all?
    const row = await loadPostForModerator(req, res);
    if (!row) return;

    // 2. Validate what was sent
    const parsed = decisionSchema.safeParse(req.body ?? {});
    if (!parsed.success) return sendValidationError(res, parsed.error);
    const { decision, organizationId } = parsed.data;
    const note = parsed.data.note ?? null;

    // 3. Only pending posts can be reviewed.
    //    There is NO "cannot review your own post" check: moderators may review
    //    their own posts (decided 2026-11-14). The record below keeps it visible.
    if (row.status !== "pending") {
      return sendError(res, 409, "CONFLICT", "This post is not pending.");
    }

    // 4. The reviewer may correct the organization tag
    let newOrganizationId = row.org_id;
    if (organizationId !== undefined) {
      const [orgRows] = await db.query("SELECT id FROM organizations WHERE id = ?", [
        organizationId,
      ]);
      if (!orgRows[0]) {
        return sendError(res, 400, "VALIDATION_ERROR", "Please fix the highlighted fields.", {
          organizationId: "Choose a valid organization.",
        });
      }
      newOrganizationId = organizationId;
    }

    // published_at is set on the FIRST approval only; later it keeps its value.
    // This text is fixed in our own code, never taken from the client.
    const publishedSql =
      decision === "approved" ? "COALESCE(published_at, NOW())" : "published_at";

    // 5. Save the decision and its record together, or neither
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // "AND status = 'pending'" makes this safe if two moderators click at the same time:
      // only the first update matches; the second one finds nothing to change.
      const [updated] = await conn.query(
        `UPDATE posts
         SET status = ?, organization_id = ?, published_at = ${publishedSql}
         WHERE id = ? AND status = 'pending' AND deleted_at IS NULL`,
        [decision, newOrganizationId, row.id]
      );
      if (updated.affectedRows === 0) {
        await conn.rollback();
        return sendError(res, 409, "CONFLICT", "This post is no longer pending.");
      }

      await conn.query(
        `INSERT INTO post_reviews
           (post_id, reviewer_id, decision, organization_id_before, organization_id_after, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [row.id, req.user.id, decision, row.org_id, newOrganizationId, note]
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    // 6. Send back the post as it is now
    const updatedRow = await findPostById(row.id);
    const reviews = await findLatestReviews([row.id]);
    const departments = await findDepartmentsById();

    res.json({
      post: formatPost(updatedRow, {
        department: departments.get(updatedRow.department_id),
        review: formatReview(reviews.get(row.id), { includeModerator: true }),
      }),
    });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

module.exports = router;