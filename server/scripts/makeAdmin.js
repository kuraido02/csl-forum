const db = require("../db");

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.log("Usage: node scripts/makeAdmin.js <username>");
    return;
  }

  const [result] = await db.query(
    `UPDATE users
     SET role = 'admin', school_verified_at = COALESCE(school_verified_at, NOW())
     WHERE username = ? AND status = 'active'`,
    [username]
  );

  if (result.affectedRows === 0) {
    console.log(`No active user named "${username}".`);
  } else {
    console.log(`"${username}" is now an admin.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.end());