const express = require("express");
const { z } = require("zod");
const db = require("../db");
const requireAuth = require("../middleware/requireAuth");
const requireAdmin = require("../middleware/requireAdmin");
const { sendError, sendValidationError } = require("../utils/http");

const router = express.Router();

const submitSchema = z.object({
  schoolIdNumber: z.string().trim().min(1, "Required.").max(30, "Up to 30 characters."),
  note: z.string().trim().max(500, "Up to 500 characters.").optional(),
});

router.post("/verification-requests", requireAuth, async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const { schoolIdNumber, note } = parsed.data;

  try {
    const [users] = await db.query(
      "SELECT school_verified_at FROM users WHERE id = ? AND status = 'active'",
      [req.user.id]
    );
    const me = users[0];
    if (!me) return sendError(res, 401, "UNAUTHENTICATED", "Please log in.");

    if (me.school_verified_at) {
      return sendError(res, 409, "CONFLICT", "Your account is already verified.");
    }

    const [pending] = await db.query(
      "SELECT id FROM school_verification_requests WHERE user_id = ? AND status = 'pending' LIMIT 1",
      [req.user.id]
    );
    if (pending[0]) {
      return sendError(res, 409, "CONFLICT", "You already have a request waiting for review.");
    }

    const [taken] = await db.query(
      "SELECT user_id FROM profiles WHERE school_id_number = ? AND user_id <> ? LIMIT 1",
      [schoolIdNumber, req.user.id]
    );
    if (taken[0]) {
      return sendError(res, 409, "CONFLICT", "This school ID is already used by another account.", {
        schoolIdNumber: "This school ID is already used by another account.",
      });
    }

    const [result] = await db.query(
      "INSERT INTO school_verification_requests (user_id, school_id_number, note) VALUES (?, ?, ?)",
      [req.user.id, schoolIdNumber, note || null]
    );

    res.status(201).json({
      request: { id: result.insertId, status: "pending", createdAt: new Date().toISOString() },
    });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

router.get("/verification-requests/me", requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, status, reject_reason, created_at
       FROM school_verification_requests
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [req.user.id]
    );
    const row = rows[0];

    res.json({
      request: row
        ? {
            id: row.id,
            status: row.status,
            rejectReason: row.reject_reason,
            createdAt: row.created_at,
          }
        : null,
    });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

router.get("/admin/verification-requests", requireAuth, requireAdmin, async (req, res) => {
  const status = req.query.status ?? "pending";
  if (!["pending", "approved", "rejected"].includes(status)) {
    return sendError(res, 400, "VALIDATION_ERROR", "Status must be pending, approved or rejected.", {
      status: "Must be pending, approved or rejected.",
    });
  }

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = 20;
  const order = status === "pending" ? "ASC" : "DESC"; // oldest waiting first

  try {
    const [rows] = await db.query(
      `SELECT r.id, r.status, r.school_id_number, r.note, r.reject_reason, r.created_at,
              u.id AS user_id, u.username, u.role, u.email, p.display_name
       FROM school_verification_requests r
       JOIN users u ON u.id = r.user_id
       JOIN profiles p ON p.user_id = u.id
       WHERE r.status = ?
       ORDER BY r.created_at ${order}
       LIMIT ? OFFSET ?`,
      [status, pageSize, (page - 1) * pageSize]
    );

    const [counts] = await db.query(
      "SELECT COUNT(*) AS total FROM school_verification_requests WHERE status = ?",
      [status]
    );

    res.json({
      items: rows.map((r) => ({
        id: r.id,
        status: r.status,
        schoolIdNumber: r.school_id_number,
        note: r.note,
        rejectReason: r.reject_reason,
        createdAt: r.created_at,
        user: {
          id: r.user_id,
          username: r.username,
          role: r.role,
          email: r.email,
          displayName: r.display_name,
        },
      })),
      page,
      pageSize,
      total: counts[0].total,
    });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

const reviewSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
    rejectReason: z.string().trim().max(255, "Up to 255 characters.").optional(),
  })
  .refine((data) => data.status !== "rejected" || data.rejectReason, {
    message: "Give a reason for rejecting.",
    path: ["rejectReason"],
  });

router.patch("/admin/verification-requests/:id", requireAuth, requireAdmin, async (req, res) => {
  const requestId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(requestId)) {
    return sendError(res, 404, "NOT_FOUND", "Request not found.");
  }

  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const { status, rejectReason } = parsed.data;

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      "SELECT id, user_id, school_id_number, status FROM school_verification_requests WHERE id = ? FOR UPDATE",
      [requestId]
    );
    const request = rows[0];

    if (!request) {
      await conn.rollback();
      return sendError(res, 404, "NOT_FOUND", "Request not found.");
    }
    if (request.status !== "pending") {
      await conn.rollback();
      return sendError(res, 409, "CONFLICT", "This request was already reviewed.");
    }

    await conn.query(
      `UPDATE school_verification_requests
       SET status = ?, reviewed_by = ?, reviewed_at = NOW(), reject_reason = ?
       WHERE id = ?`,
      [status, req.user.id, status === "rejected" ? rejectReason : null, requestId]
    );

    if (status === "approved") {
      const [verified] = await conn.query(
        "UPDATE users SET school_verified_at = NOW() WHERE id = ? AND status = 'active'",
        [request.user_id]
      );
      if (verified.affectedRows === 0) {
        await conn.rollback();
        return sendError(res, 409, "CONFLICT", "This user's account is no longer active.");
      }

      await conn.query("UPDATE profiles SET school_id_number = ? WHERE user_id = ?", [
        request.school_id_number,
        request.user_id,
      ]);
    }

    await conn.commit();

    res.json({
      request: {
        id: requestId,
        status,
        rejectReason: status === "rejected" ? rejectReason : null,
        reviewedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    if (conn) await conn.rollback();

    if (err.code === "ER_DUP_ENTRY") {
      return sendError(res, 409, "CONFLICT", "That school ID is already used by another account.");
    }

    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;