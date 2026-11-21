const express = require("express");
const { z } = require("zod");
const db = require("../db");
const requireAuth = require("../middleware/requireAuth");
const requireAdmin = require("../middleware/requireAdmin");
const { listDepartments } = require("../utils/department");
const { sendError, sendValidationError } = require("../utils/http");

const router = express.Router();

const OFFICES = ["president", "vice_president"];

// Reads :departmentId and :office from the URL. If either is wrong, or the
// department does not exist, it sends a 404 itself and returns null.
// E3 (remove) uses the same helper.
async function loadDepartmentAndOffice(req, res) {
  const { departmentId, office } = req.params;

  if (!/^\d+$/.test(departmentId) || !OFFICES.includes(office)) {
    sendError(res, 404, "NOT_FOUND", "Department or office not found.");
    return null;
  }

  const [rows] = await db.query("SELECT id FROM departments WHERE id = ?", [
    Number(departmentId),
  ]);
  if (!rows[0]) {
    sendError(res, 404, "NOT_FOUND", "Department or office not found.");
    return null;
  }

  return { departmentId: rows[0].id, office };
}

// The departments and who holds each office. Admins only.
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    res.json({ items: await listDepartments() });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

const assignSchema = z.object({
  username: z.string("Required.").trim().min(1, "Required."),
});

router.put("/:departmentId/moderators/:office", requireAuth, requireAdmin, async (req, res) => {
  try {
    // 1. Is the department and office in the URL real?
    const target = await loadDepartmentAndOffice(req, res);
    if (!target) return;
    const { departmentId, office } = target;

    // 2. Validate the body
    const parsed = assignSchema.safeParse(req.body ?? {});
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const usernameError = (message) =>
      sendError(res, 400, "VALIDATION_ERROR", "Please fix the highlighted fields.", {
        username: message,
      });

    // 3. Find the person and check they may hold this office
    const [userRows] = await db.query(
      `SELECT u.id, u.status, u.email_verified_at, u.school_verified_at,
              c.department_id
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       LEFT JOIN courses c ON c.id = p.course_id
       WHERE u.username = ?
       LIMIT 1`,
      [parsed.data.username]
    );
    const person = userRows[0];

    if (!person) return usernameError("No user with that username.");
    if (person.status !== "active") return usernameError("This account is not active.");
    if (!person.email_verified_at) return usernameError("This user has not verified their email.");
    if (!person.school_verified_at) return usernameError("This user is not school-verified.");
    if (person.department_id !== departmentId) {
      return usernameError("This user's course does not belong to this department.");
    }

    // 4. A person can hold only ONE office anywhere
    const [heldRows] = await db.query(
      "SELECT department_id, office FROM department_moderators WHERE user_id = ?",
      [person.id]
    );
    const held = heldRows[0];
    const alreadyHere = Boolean(held) && held.department_id === departmentId && held.office === office;

    if (held && !alreadyHere) {
      return sendError(res, 409, "CONFLICT", "This user already holds another office.", {
        username: "This user already holds another office.",
      });
    }

    // 5. Replace whoever holds the office (unless it is already this person)
    if (!alreadyHere) {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        await conn.query("DELETE FROM department_moderators WHERE department_id = ? AND office = ?", [
          departmentId,
          office,
        ]);
        await conn.query(
          "INSERT INTO department_moderators (department_id, user_id, office) VALUES (?, ?, ?)",
          [departmentId, person.id, office]
        );

        await conn.commit();
      } catch (err) {
        await conn.rollback();
        // Two admins at the same moment: the table's UNIQUE keys stop the second one
        if (err.code === "ER_DUP_ENTRY") {
          return sendError(res, 409, "CONFLICT", "This office or user was just changed. Try again.");
        }
        throw err;
      } finally {
        conn.release();
      }
    }

    // 6. Send back the department as it is now
    const [entry] = await listDepartments(departmentId);
    res.json(entry);
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

// Vacate an office. The person simply stops being a moderator.
router.delete("/:departmentId/moderators/:office", requireAuth, requireAdmin, async (req, res) => {
  try {
    // Is the department and office in the URL real?
    const target = await loadDepartmentAndOffice(req, res);
    if (!target) return;
    const { departmentId, office } = target;

    const [result] = await db.query(
      "DELETE FROM department_moderators WHERE department_id = ? AND office = ?",
      [departmentId, office]
    );

    // Nothing was deleted: the office was already empty
    if (result.affectedRows === 0) {
      return sendError(res, 404, "NOT_FOUND", "Nobody holds this office.");
    }

    res.status(204).send();
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

module.exports = router;