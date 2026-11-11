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
      program: row.program,
      yearLevel: row.year_level,
    },
  };
}

module.exports = formatUser;