const db = require("../db");

// The five departments, each with its President and Vice President (or null).
// Pass a department id to get just that one department (in a list of one).
async function listDepartments(onlyId = null) {
  const where = onlyId === null ? "" : "WHERE d.id = ?";
  const params = onlyId === null ? [] : [onlyId];

  const [rows] = await db.query(
    `SELECT d.id, d.code, d.name,
            dm.office,
            u.id AS user_id, u.username,
            p.display_name
     FROM departments d
     LEFT JOIN department_moderators dm ON dm.department_id = d.id
     LEFT JOIN users u ON u.id = dm.user_id
     LEFT JOIN profiles p ON p.user_id = u.id
     ${where}
     ORDER BY d.id`,
    params
  );

  // One query returns one row per (department, office). Group them by department.
  const byId = new Map();
  for (const row of rows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, {
        id: row.id,
        code: row.code,
        name: row.name,
        president: null,
        vicePresident: null,
      });
    }

    if (row.office) {
      const person = { id: row.user_id, username: row.username, displayName: row.display_name };
      const entry = byId.get(row.id);
      if (row.office === "president") entry.president = person;
      else entry.vicePresident = person;
    }
  }

  return [...byId.values()];
}

module.exports = { listDepartments };