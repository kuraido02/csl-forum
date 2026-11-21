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

module.exports = router;