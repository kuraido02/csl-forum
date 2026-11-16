const express = require("express");
const db = require("../db");
const { sendError } = require("../utils/http");

const router = express.Router();

router.get("/courses", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.id, c.code, c.name,
              d.id   AS department_id,
              d.code AS department_code,
              d.name AS department_name
       FROM courses c
       JOIN departments d ON d.id = c.department_id
       ORDER BY c.id`
    );

    res.json({
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        department: {
          id: row.department_id,
          code: row.department_code,
          name: row.department_name,
        },
      })),
    });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

router.get("/organizations", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT o.id, o.code, o.name, COUNT(p.id) AS post_count
       FROM organizations o
       LEFT JOIN posts p
         ON p.organization_id = o.id
        AND p.status = 'approved'
        AND p.deleted_at IS NULL
       GROUP BY o.id, o.code, o.name
       ORDER BY o.id`
    );

    res.json({
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        postCount: Number(row.post_count),
      })),
    });
  } catch (err) {
    console.error(err);
    sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
});

module.exports = router;