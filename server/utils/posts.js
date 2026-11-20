const db = require("../db");

// The one SELECT that loads a post with its organization and author.
// Callers add their own WHERE part after it.
const POST_SELECT = `
  SELECT p.id, p.title, p.body, p.link_url, p.image_url, p.status,
         p.created_at, p.published_at, p.author_id, p.department_id,
         o.id   AS org_id,
         o.code AS org_code,
         o.name AS org_name,
         u.username AS author_username,
         u.status   AS author_status,
         pr.display_name AS author_display_name,
         pr.avatar_url   AS author_avatar_url,
         pr.school_year  AS author_school_year,
         pr.year_level   AS author_year_level,
         c.id   AS author_course_id,
         c.code AS author_course_code,
         c.name AS author_course_name
  FROM posts p
  JOIN organizations o ON o.id = p.organization_id
  JOIN users u ON u.id = p.author_id
  JOIN profiles pr ON pr.user_id = u.id
  LEFT JOIN courses c ON c.id = pr.course_id
`;

// One post by id. Deleted posts are never returned.
async function findPostById(id) {
  const [rows] = await db.query(
    `${POST_SELECT}
     WHERE p.id = ? AND p.deleted_at IS NULL
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

// The latest review of each post in a list, as a Map: postId -> review row.
// One query for all the posts, so a list of 20 posts needs only one extra query.
async function findLatestReviews(postIds) {
  const latest = new Map();
  if (postIds.length === 0) return latest;

  const [rows] = await db.query(
    `SELECT r.post_id, r.decision, r.note, r.created_at,
            r.reviewer_id, u.username AS reviewer_username
     FROM post_reviews r
     JOIN users u ON u.id = r.reviewer_id
     WHERE r.post_id IN (?)
     ORDER BY r.created_at DESC, r.id DESC`,
    [postIds]
  );

  // Rows come newest first, so the first one we see for a post is its latest
  for (const row of rows) {
    if (!latest.has(row.post_id)) latest.set(row.post_id, row);
  }
  return latest;
}

// All five departments as a Map: id -> { id, code, name }.
// Only five rows, so one tiny query covers a whole page of posts.
async function findDepartmentsById() {
  const [rows] = await db.query("SELECT id, code, name FROM departments");
  return new Map(rows.map((row) => [row.id, { id: row.id, code: row.code, name: row.name }]));
}

module.exports = { POST_SELECT, findPostById, findLatestReviews, findDepartmentsById };