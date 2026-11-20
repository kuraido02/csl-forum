const db = require("../db");
const { sendError } = require("../utils/http");

// Lets through admins and department moderators (President / Vice President).
// It sets req.moderator = { isAdmin, departmentId } for the route to use.
// requireAuth must run BEFORE this, so req.user exists.
async function requireModerator(req, res, next) {
  try {
    const [rows] = await db.query(
      `SELECT u.role, dm.department_id
       FROM users u
       LEFT JOIN department_moderators dm ON dm.user_id = u.id
       WHERE u.id = ? AND u.status = 'active'`,
      [req.user.id]
    );
    const row = rows[0];
    if (!row) return sendError(res, 401, "UNAUTHENTICATED", "Please log in.");

    const isAdmin = row.role === "admin";
    if (!isAdmin && !row.department_id) {
      return sendError(res, 403, "FORBIDDEN", "Moderators only.");
    }

    req.moderator = { isAdmin, departmentId: row.department_id };
    next();
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
}

module.exports = requireModerator;