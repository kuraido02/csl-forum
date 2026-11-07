const db = require("../db");

async function findFullUserById(id) {
  const [rows] = await db.query(
    `SELECT u.*, p.display_name, p.bio, p.avatar_url,
            p.school_id_number, p.program, p.year_level
     FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE u.id = ? AND u.status = 'active'
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { findFullUserById };