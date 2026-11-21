const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const requireAdmin = require("../middleware/requireAdmin");
const { listDepartments } = require("../utils/department");
const { sendError } = require("../utils/http");

const router = express.Router();

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