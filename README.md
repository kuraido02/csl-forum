# CSL Forum

A school forum for students and teachers (thesis project).

- **Frontend:** React (Vite) in `client/`
- **Backend:** Node.js + Express in `server/`
- **Database:** MySQL
- **API reference:** [`docs/api-contract.md`](docs/api-contract.md). It is the agreement between frontend and backend. If an endpoint changes, update it in the same pull request.

## Status

| Phase | What | Backend | Frontend |
|---|---|---|---|
| 1 | User and account foundation (register, login, profiles, school verification) | Done | In progress |
| 2 | Core posting system, including moderation | Database in progress | Not started |

---

## 1. What you need installed

- [Node.js](https://nodejs.org) (LTS version). Check with `node -v` and `npm -v`.
- [Git](https://git-scm.com). Check with `git --version`.
- [VS Code](https://code.visualstudio.com).
- [XAMPP](https://www.apachefriends.org) (only for its **MySQL**; you do not need Apache for the app, but phpMyAdmin uses it).

## 2. Get the project

Open a terminal in the folder where you keep projects (for example `C:\Projects`):

```
git clone https://github.com/kuraido02/csl-forum.git
cd csl-forum
code .
```

## 3. Set up the database

1. Open XAMPP and **Start MySQL**. For phpMyAdmin, also start Apache.
2. Install the Phase 1 tables. Pick one way:
   - **phpMyAdmin:** click **Admin** on the MySQL row, open the **Import** tab, choose `server/db/schema.sql`, and click **Import**.
   - **PowerShell**, from the project root:
     ```
     & "C:\xampp\mysql\bin\mysql.exe" -u root -e "source server/db/schema.sql"
     ```
3. Apply the Phase 2 posting and moderation migration once:
   ```
   & "C:\xampp\mysql\bin\mysql.exe" -u root csl_forum -e "source server/db/migrations/002_phase2_posting_moderation.sql"
   ```
4. Check: `csl_forum` should contain the 4 Phase 1 tables plus `departments`, `courses`, `organizations`, `department_moderators`, `posts`, and `post_reviews`.

The migration adds placeholder course, department, and organization names. Replace those with the official school names before production use. Existing profile `program` values are kept; assign each user a `course_id` before allowing posts.

## 4. Set up and run the server

```
cd server
npm install
Copy-Item .env.example .env
```

Open `server/.env` and fill it in:

| Setting | What to put |
|---|---|
| `PORT`, `CLIENT_URL`, `DB_*` | The defaults already work with XAMPP (the `root` user has no password) |
| `JWT_SECRET` | A long random string. Generate one with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` | Only needed to send real emails (see below). You can leave them empty while building the UI |

Start the server:

```
npm run dev
```

Open <http://localhost:3000/api/health>. You should see `{"status":"ok","users":0}`.

### Emails (verification and password reset)

The server sends emails through Gmail. Ask the project owner for the credentials, or make your own: create a Gmail account, turn on 2-Step Verification, create an **App Password** at `myaccount.google.com/apppasswords`, and put the 16 characters (no spaces) in `EMAIL_PASS`.

**Never commit `.env` or share the App Password in chat or on GitHub.**

If you leave the email settings empty, registration still works but no email is sent (the server prints an error in the terminal). To verify an account by hand while developing, run this in phpMyAdmin's **SQL** tab:

```sql
UPDATE users SET email_verified_at = NOW() WHERE username = 'the_username';
```

Always keep the `WHERE` part, or it changes every user.

### Make an admin

Register and verify a normal account first, then in the `server` folder:

```
node scripts/makeAdmin.js the_username
```

## 5. Set up and run the client

In a **second terminal**:

```
cd client
npm install
npm run dev
```

Open <http://localhost:5173>.

The server only accepts requests from `http://localhost:5173` (the `CLIENT_URL` setting), so use that address and port.

---

## Project structure

```
csl-forum/
├── client/            React app (Vite)
│   └── src/
├── server/
│   ├── db/schema.sql  Database tables
│   ├── middleware/    requireAuth, requireAdmin, rate limiters
│   ├── routes/        auth, users, verification
│   ├── scripts/       makeAdmin.js
│   ├── utils/         helpers (errors, emails, tokens, cookies, ...)
│   ├── uploads/       Uploaded avatars (created automatically, not in Git)
│   ├── db.js          MySQL connection
│   └── index.js       Server entry point
└── docs/
    └── api-contract.md
```

## Notes for frontend work

- Login uses an **httpOnly cookie**. Send `credentials: "include"` (fetch) or `withCredentials: true` (axios) on **every** request, or the cookie is not sent.
- You cannot read the cookie. To know who is logged in, call `GET /api/auth/me` when the app loads.
- Every error has the same shape: `{ "error": { "code", "message", "fields?" } }`. Show `message` to the user and use `fields` to mark inputs.
- Show avatars as `http://localhost:3000` + `avatarUrl`.
- In development, React can run an effect twice. The verify-email page may call the API twice with the same token; the second call returns `410`, which should not show an error after the first one succeeded.
- You can build pages with fake data first, using the example responses in the contract, and connect to the real server later.

## Testing the API without the UI

Use the **Thunder Client** extension in VS Code. Keep one saved request per endpoint. Before pressing Send, check the **method, URL and body** together, and remember that the login cookie is shared by all requests, so use `GET /api/auth/me` to see who you are logged in as.

## Working together with Git

```
git pull                              # always first
git checkout -b feature/short-name    # your own branch
# ...work...
git add .
git commit -m "Clear message about what changed"
git push -u origin feature/short-name
```

Then open a pull request on GitHub. Rules:

- Never commit `.env`, `node_modules`, or `uploads` (already in `.gitignore`).
- Tell each other before changing shared files such as `App.jsx` or `main.jsx`.
- Do not install new packages without telling the other developer.
- Update `docs/api-contract.md` in the same pull request as any API change.

## Common problems

| Problem | Fix |
|---|---|
| `ECONNREFUSED 127.0.0.1:3306` | MySQL is not running. Start it in XAMPP |
| Server crashes with a `SyntaxError` | Read the first red lines in the terminal. They name the file and line |
| Login works in Thunder Client but not in the browser | The request is missing `credentials: "include"` |
| CORS error in the browser | Use `http://localhost:5173`, and check `CLIENT_URL` in `server/.env` |
| `429 RATE_LIMITED` | Too many attempts. Wait a few minutes, or restart the server to reset the counters |
| `npm audit` warns about vulnerabilities | Safe to ignore for now. Do not run `npm audit fix --force` |
| `.env` changes have no effect | Restart the server. Nodemon only restarts on code changes |

