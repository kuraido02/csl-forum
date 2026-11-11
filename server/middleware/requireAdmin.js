const db = require("../db");
const { sendError } = require("../utils/http");

async function requireAdmin(req, res, next) {
  try {
    const [rows] = await db.query(
      "SELECT role FROM users WHERE id = ? AND status = 'active'",
      [req.user.id]
    );

    if (rows[0]?.role !== "admin") {
      return sendError(res, 403, "FORBIDDEN", "Admins only.");
    }

    next();
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
}

module.exports = requireAdmin;