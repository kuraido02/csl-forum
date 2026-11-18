// Turns one database row into the `post` object from the contract.
// summary = true gives the list version (`excerpt` instead of `body`).
// Anything else passed in (like `review`) is added to the result.
function formatPost(row, { summary = false, ...extras } = {}) {
  // A deleted author's username is "deleted_<id>"; show "[deleted]" instead
  const authorDeleted = row.author_status === "deleted";

  const post = {
    id: row.id,
    title: row.title,
    ...(summary
      ? { excerpt: row.body ? row.body.slice(0, 300) : null }
      : { body: row.body }),
    linkUrl: row.link_url,
    imageUrl: row.image_url,
    status: row.status,
    organization: { id: row.org_id, code: row.org_code, name: row.org_name },
    author: {
      id: row.author_id,
      username: authorDeleted ? "[deleted]" : row.author_username,
      displayName: authorDeleted ? "[deleted]" : row.author_display_name,
      avatarUrl: authorDeleted ? null : row.author_avatar_url,
      course:
        !authorDeleted && row.author_course_id
          ? {
              id: row.author_course_id,
              code: row.author_course_code,
              name: row.author_course_name,
            }
          : null,
      schoolYear: authorDeleted ? null : row.author_school_year,
      yearLevel: authorDeleted ? null : row.author_year_level,
    },
    createdAt: row.created_at,
    publishedAt: row.published_at,
  };

  return { ...post, ...extras };
}

// Turns a review row into the `review` object from the contract.
// Only moderators and admins also get the `moderator` part.
function formatReview(row, { includeModerator = false } = {}) {
  if (!row) return null;

  const review = {
    decision: row.decision,
    note: row.note,
    reviewedAt: row.created_at,
  };
  if (includeModerator) {
    review.moderator = { id: row.reviewer_id, username: row.reviewer_username };
  }
  return review;
}

module.exports = formatPost;
module.exports.formatReview = formatReview;