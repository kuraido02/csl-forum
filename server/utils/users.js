const db = require("../db");

// The one SELECT that loads a user together with their profile, course
// and moderator office. Other files add their own WHERE part after it.
const USER_SELECT = `
  SELECT u.*,
         p.display_name, p.bio, p.avatar_url, p.school_id_number,
         p.school_year, p.year_level,
         c.id   AS course_id,
         c.code AS course_code,
         c.name AS course_name,
         dm.office AS moderator_office,
         md.id   AS moderator_department_id,
         md.code AS moderator_department_code,
         md.name AS moderator_department_name
  FROM users u
  JOIN profiles p ON p.user_id = u.id
  LEFT JOIN courses c ON c.id = p.course_id
  LEFT JOIN department_moderators dm ON dm.user_id = u.id
  LEFT JOIN departments md ON md.id = dm.department_id
`;

async function findFullUserById(id) {
  const [rows] = await db.query(
    `${USER_SELECT}
     WHERE u.id = ? AND u.status = 'active'
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { USER_SELECT, findFullUserById };