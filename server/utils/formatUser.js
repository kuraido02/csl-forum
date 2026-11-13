function formatUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    emailVerified: row.email_verified_at !== null,
    schoolVerified: row.school_verified_at !== null,
    createdAt: row.created_at,
    profile: {
      displayName: row.display_name,
      bio: row.bio,
      avatarUrl: row.avatar_url,
      schoolIdNumber: row.school_id_number,
      course: row.course_id
        ? { id: row.course_id, code: row.course_code, name: row.course_name }
        : null,
      schoolYear: row.school_year,
      yearLevel: row.year_level,
    },
    moderator: row.moderator_office
      ? {
          department: {
            id: row.moderator_department_id,
            code: row.moderator_department_code,
            name: row.moderator_department_name,
          },
          office: row.moderator_office,
        }
      : null,
  };
}

module.exports = formatUser;