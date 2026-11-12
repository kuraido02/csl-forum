# CSL Forum — API Contract (Phase 1 + Phase 2)

Shared agreement between **backend (server/)** and **frontend (client/)**.
If an endpoint changes, update this file in the same pull request.

## Conventions

- Base URL (dev): `http://localhost:3000/api`
- Request/response bodies are JSON, except uploads (`multipart/form-data`: avatar and post image/forms).
- JSON keys are **camelCase**. (Database columns are snake_case; the backend converts.)
- Dates are ISO 8601 strings in UTC, e.g. `"2026-11-04T09:30:00.000Z"`.
- **Auth uses an httpOnly cookie** named `token`, set by the server on login.
  - Frontend must send `credentials: "include"` on every request (fetch) or `withCredentials: true` (axios).
  - Server CORS allows origin `http://localhost:5173` with credentials.
  - The frontend cannot read the cookie. To know who is logged in, call `GET /auth/me`.
- 🔒 = login required (returns `401 UNAUTHENTICATED` when not logged in).
- 🧑‍⚖️ = moderator (department President or Vice President) or admin.
- 🛡️ = admin only. Both 🧑‍⚖️ and 🛡️ return `403 FORBIDDEN` for everyone else.

### Error format (every error)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please fix the highlighted fields.",
    "fields": { "email": "Email is already used." }
  }
}
```

`fields` is only present when an error belongs to specific inputs. Show `message` to the user; use `fields` to mark inputs.

| HTTP | code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Bad or missing input, including a wrong current password |
| 401 | `UNAUTHENTICATED` | Not logged in / bad login credentials |
| 403 | `FORBIDDEN` | Logged in but not allowed (e.g. not admin, not the author, wrong department) |
| 403 | `EMAIL_NOT_VERIFIED` | Login blocked until the email is verified |
| 403 | `ACCOUNT_BANNED` | Account is banned |
| 403 | `SCHOOL_NOT_VERIFIED` | Posting needs a school-verified account |
| 403 | `PROFILE_INCOMPLETE` | Posting needs a registered course in the profile |
| 404 | `NOT_FOUND` | Thing doesn't exist (or you are not allowed to know it exists) |
| 409 | `CONFLICT` | Already exists or already done (username/email taken, request already reviewed, ...) |
| 410 | `TOKEN_INVALID` | Verification/reset token is wrong, used, or expired |
| 429 | `RATE_LIMITED` | Too many attempts |
| 500 | `SERVER_ERROR` | Our bug |

### Field rules (frontend should validate the same way)

| Field | Rule |
|---|---|
| `username` | 3–30 chars, letters/numbers/underscore only, case-insensitive unique |
| `email` | valid email format, unique |
| `password` | min 8 chars, at least 1 letter and 1 number |
| `displayName` | 1–50 chars |
| `bio` | up to 500 chars |
| `courseId` | the id of one of the five courses (`GET /courses`) |
| `schoolYear` | `YYYY-YYYY` with consecutive years, e.g. `2026-2027` |
| `yearLevel` | integer 1–4 (students) |
| `avatar` | image/jpeg, image/png, image/webp; max 2 MB |
| `role` (signup) | `"student"` or `"teacher"` |
| `schoolIdNumber` | up to 30 chars. Only sent in a verification request; read-only everywhere else |
| `title` (post) | 1–200 chars |
| `body` (post) | up to 10,000 chars |
| `linkUrl` (post) | valid `http://` or `https://` URL, up to 2048 chars |
| `image` (post) | image/jpeg, image/png, image/webp; max 5 MB; one image per post |
| `note` (review) | up to 500 chars |

### The `user` object (returned by several endpoints)

```json
{
  "id": 12,
  "username": "ivan_clyd",
  "email": "ivan@school.edu.ph",
  "role": "student",
  "status": "active",
  "emailVerified": true,
  "schoolVerified": false,
  "createdAt": "2026-11-04T09:30:00.000Z",
  "profile": {
    "displayName": "Ivan Clyd",
    "bio": "BSCS 4th year",
    "avatarUrl": "/uploads/avatars/12-1731200000000.png",
    "schoolIdNumber": "2022-00123",
    "course": { "id": 1, "code": "BSCS", "name": "BS Computer Science" },
    "schoolYear": "2026-2027",
    "yearLevel": 4
  },
  "moderator": null
}
```

- `email` and `schoolIdNumber` are **only** returned to the account owner (and to admins in the verification list).
- `avatarUrl` is `null` when the user has no avatar. Show it as `http://localhost:3000` + `avatarUrl`.
- `profile.course` is `null` for old accounts that haven't picked a course yet.
- `moderator` is `null` for normal users. For a department President or Vice President it is
  `{ "department": { "id": 1, "code": "CS", "name": "Computer Science Department" }, "office": "president" }`
  (`office` is `"president"` or `"vice_president"`). Use it to show the moderation menu.

### The `post` object

```json
{
  "id": 31,
  "title": "An easier way to understand binary numbers",
  "body": "Think of each bit as a light switch...",
  "linkUrl": "https://www.youtube.com/watch?v=abc123",
  "imageUrl": "/uploads/posts/31-1731300000000.png",
  "status": "approved",
  "organization": { "id": 1, "code": "BSCS", "name": "BS Computer Science" },
  "author": {
    "id": 12,
    "username": "ivan_clyd",
    "displayName": "Ivan Clyd",
    "avatarUrl": "/uploads/avatars/12-1731200000000.png",
    "course": { "id": 5, "code": "BSED", "name": "BS Education" },
    "schoolYear": "2026-2027",
    "yearLevel": 2
  },
  "createdAt": "2026-11-11T09:00:00.000Z",
  "publishedAt": "2026-11-11T10:30:00.000Z"
}
```

- `body`, `linkUrl`, `imageUrl` are `null` when not used. A post always has a `title` and at least one of `body`, `linkUrl`, `imageUrl`.
- `author.course`, `schoolYear` and `yearLevel` are for the hover card on the author's name or picture. They are information only and do not limit what anyone can see.
- **`PostSummary`** (used in lists) is the same object, but with `excerpt` (first 300 characters of the body) instead of `body`.
- Extra fields, only when they apply to the viewer:
  - `review` (to the author and moderators): the latest decision `{ "decision": "rejected", "note": "Please add a source.", "reviewedAt": "..." }`, or `null`.
  - `department` (to moderators and admins): the department responsible, `{ "id": 1, "code": "CS", "name": "..." }`.
  - `moderator` inside `review` (to moderators and admins only): `{ "id": 7, "username": "cs_president" }`.
  - `createdAt` is when the post was first submitted. `publishedAt` is when a moderator first approved it (`null` until then). There is no "edited" date in Phase 2: editing a post sends it back to `pending`, and the author sees its status instead.

---

## 1. Auth

### POST `/auth/register`
Create an account and email a verification link.

Request
```json
{
  "username": "ivan_clyd",
  "email": "ivan@school.edu.ph",
  "password": "Secret123",
  "displayName": "Ivan Clyd",
  "role": "student",
  "courseId": 1,
  "schoolYear": "2026-2027",
  "yearLevel": 4
}
```
- Students must send `courseId`, `schoolYear` and `yearLevel`.
- Teachers send `courseId` (the course of their department); `schoolYear` and `yearLevel` are ignored.
- `201` → `{ "user": { ...user } }` (user is **not** logged in yet; they must verify email, then log in)
- `400 VALIDATION_ERROR`, `409 CONFLICT` (username or email taken; `fields` says which)

### POST `/auth/login`
Request
```json
{ "identifier": "ivan_clyd", "password": "Secret123" }
```
`identifier` can be the username **or** the email.
- `200` → `{ "user": { ...user } }` and the `token` cookie is set
- `401 UNAUTHENTICATED` (same message for wrong username or wrong password)
- `403 EMAIL_NOT_VERIFIED`, `403 ACCOUNT_BANNED`
- `429 RATE_LIMITED`

### POST `/auth/logout`
Works even when not logged in.
- `204` (no body). Cookie is cleared.

### GET `/auth/me` 🔒
Call this when the app loads to restore the logged-in state.
- `200` → `{ "user": { ...user } }`
- `401 UNAUTHENTICATED` → show logged-out UI (also returned for banned or deleted accounts)

### POST `/auth/verify-email`
The link in the email points to the **frontend**: `http://localhost:5173/verify-email?token=<token>`.
That page reads the token from the URL and calls:
```json
{ "token": "a1b2c3..." }
```
- `200` → `{ "message": "Email verified." }`
- `410 TOKEN_INVALID` (wrong, already used, or expired; each link works once)

### POST `/auth/resend-verification`
```json
{ "email": "ivan@school.edu.ph" }
```
- `200` → `{ "message": "If the account exists, a new link was sent." }` (always, to avoid leaking who has accounts)
- Sending a new link cancels the older ones.

### POST `/auth/forgot-password`
```json
{ "email": "ivan@school.edu.ph" }
```
- `200` → `{ "message": "If the account exists, a reset link was sent." }` (always the same)
- Link goes to `http://localhost:5173/reset-password?token=<token>`. Token expires in 1 hour. Only the newest link works.

### POST `/auth/reset-password`
```json
{ "token": "a1b2c3...", "newPassword": "NewSecret456" }
```
- `200` → `{ "message": "Password updated." }`
- `400 VALIDATION_ERROR` (weak password; the link stays valid so the user can try again)
- `410 TOKEN_INVALID`

### POST `/auth/change-password` 🔒
```json
{ "currentPassword": "Secret123", "newPassword": "NewSecret456" }
```
- `200` → `{ "message": "Password updated." }`
- `400 VALIDATION_ERROR` with `fields.currentPassword` (wrong current password) or `fields.newPassword` (weak, or same as the current one)

---

## 2. Account & Profile

### GET `/users/:username`
Public profile of any user (login not required).
- `200`
```json
{
  "user": {
    "id": 12,
    "username": "ivan_clyd",
    "role": "student",
    "schoolVerified": true,
    "createdAt": "2026-11-04T09:30:00.000Z",
    "profile": {
      "displayName": "Ivan Clyd",
      "bio": "BSCS 4th year",
      "avatarUrl": "/uploads/avatars/12-1731200000000.png",
      "course": { "id": 1, "code": "BSCS", "name": "BS Computer Science" },
      "schoolYear": "2026-2027",
      "yearLevel": 4
    }
  }
}
```
- `404 NOT_FOUND` (also for deleted users and for users who haven't verified their email)

### PATCH `/users/me` 🔒
Edit profile. Send only the fields you want to change. Send `null` or `""` to clear `bio`.
```json
{
  "displayName": "Ivan Clyd T. Suello",
  "bio": "Web dev student",
  "courseId": 1,
  "schoolYear": "2026-2027",
  "yearLevel": 4
}
```
- `200` → `{ "user": { ...user } }`
- `400 VALIDATION_ERROR` (also "Nothing to update." when no field is sent)

Notes:
- `schoolIdNumber` can't be edited here. It is set when an admin approves a verification request.
- Changing `courseId` only affects posts submitted or edited **afterwards**: they go to the moderators of the new department. A department moderator can't change to a course of another department while holding the office.

### POST `/users/me/avatar` 🔒
`multipart/form-data` with one file field named **`avatar`**.
- `200` → `{ "avatarUrl": "/uploads/avatars/12-1731200000000.png" }` (the number changes with every upload)
- `400 VALIDATION_ERROR` with `fields.avatar` (no file, wrong type, or bigger than 2 MB)
- Display with `http://localhost:3000` + `avatarUrl`.

### DELETE `/users/me/avatar` 🔒
- `204` (profile goes back to the default avatar)

### DELETE `/users/me` 🔒
Delete own account (soft delete). Requires password.
```json
{ "password": "Secret123" }
```
- `204` and the cookie is cleared. The account is soft-deleted: username and email are freed, profile data is erased, a moderator office is vacated.
- The user's `pending` and `rejected` posts are removed. Their `approved` posts stay, shown as written by `[deleted]`.
- `400 VALIDATION_ERROR` with `fields.password` (wrong password)
- `403 FORBIDDEN` (admin accounts can't be deleted here)

### GET `/users/:username/posts` 🔒
Approved posts written by that user, newest first (the profile's Posts tab).
- `200` → `{ "items": [ ...PostSummary ], "page": 1, "pageSize": 20, "total": 3 }`
- `404 NOT_FOUND` (same rule as the public profile)

### GET `/users/:username/comments`  *(stub until Phase 3)*
Returns an empty list until comments exist:
```json
{ "items": [], "page": 1, "pageSize": 20, "total": 0 }
```

---

## 3. School verification (student / teacher)

Flow: user submits a request → admin reviews → on approval `schoolVerified` becomes `true`.

### POST `/verification-requests` 🔒
```json
{ "schoolIdNumber": "2022-00123", "note": "BSCS 4th year, Section A" }
```
- `201` → `{ "request": { "id": 5, "status": "pending", "createdAt": "..." } }`
- `400 VALIDATION_ERROR`
- `409 CONFLICT`: already verified, already has a pending request, or the school ID is used by another account (`fields.schoolIdNumber`). A user whose request was rejected can submit again.

### GET `/verification-requests/me` 🔒
Returns the latest request. `request` is `null` if the user never submitted one.
- `200` → `{ "request": { "id": 5, "status": "pending" | "approved" | "rejected", "rejectReason": null, "createdAt": "..." } }`

### GET `/admin/verification-requests?status=pending&page=1` 🔒🛡️
- `status` is `pending`, `approved` or `rejected` (default `pending`). Other values return `400`.
- Pending requests are listed oldest first; reviewed ones newest first.
- `200`
```json
{
  "items": [
    {
      "id": 5,
      "status": "pending",
      "schoolIdNumber": "2022-00123",
      "note": "BSCS 4th year, Section A",
      "rejectReason": null,
      "createdAt": "2026-11-04T10:00:00.000Z",
      "user": { "id": 12, "username": "ivan_clyd", "role": "student", "email": "ivan@school.edu.ph", "displayName": "Ivan Clyd" }
    }
  ],
  "page": 1, "pageSize": 20, "total": 1
}
```

### PATCH `/admin/verification-requests/:id` 🔒🛡️
`:id` is the request's id (not the user's id).
```json
{ "status": "approved" }
```
or
```json
{ "status": "rejected", "rejectReason": "ID number not found in the student list." }
```
- `200` → `{ "request": { "id": 5, "status": "approved", "rejectReason": null, "reviewedAt": "..." } }`
- `400 VALIDATION_ERROR` (a rejection needs a `rejectReason`)
- `404 NOT_FOUND` (no such request)
- `409 CONFLICT`: already reviewed, the account is no longer active, or the school ID is used by another account

Approving sets the user's `schoolVerified` to `true` and saves the school ID in their profile.

---

## 4. Reference data

### GET `/courses`
The five courses a user can register under (login not required, so the sign-up form can use it).
- `200`
```json
{
  "items": [
    { "id": 1, "code": "BSCS", "name": "BS Computer Science", "department": { "id": 1, "code": "CS", "name": "Computer Science Department" } }
  ]
}
```

### GET `/organizations`
The five organization tags (academic classifications for posts). Login not required.
- `200`
```json
{
  "items": [
    { "id": 1, "code": "BSCS", "name": "BS Computer Science", "postCount": 12 }
  ]
}
```
`postCount` counts approved posts. Organizations are fixed: created and maintained by the system/admin, never by users. They are **not** communities: there is no joining or membership.

---

## 5. Posts

### Posting rules

1. Only a **school-verified** user with a **registered course** can post (`403 SCHOOL_NOT_VERIFIED`, `403 PROFILE_INCOMPLETE`).
2. Every post needs an **organization tag**. Any of the five can be chosen, whatever the author's own course is.
3. No post is published directly. A new post is `pending` and is **not** visible on the homepage until a moderator approves it.
4. **The moderating department is decided by the server** from the **author's registered course**, never from the organization tag. The client cannot choose it; a `departmentId` sent by the client is ignored.
5. Editing a post sends it back to `pending` (and to the moderators of the author's current department). An `approved` post that is edited disappears from the homepage until approved again. A `rejected` post is corrected and resubmitted the same way.
6. Only the author can edit or delete a post. Deleting is permanent from the user's point of view (the record is kept internally).
7. Only images (one per post) and external links are supported. No video or audio uploads. A YouTube or Google Drive link is posted as a link.

### Who can see a post

| Post status | Who can see it |
|---|---|
| `approved` | Every logged-in user, whatever their course |
| `pending`, `rejected` | The author, the moderators of the post's department, and admins. Everyone else gets `404` |
| deleted | Nobody (`404`) |

### POST `/posts` 🔒
`multipart/form-data` (use `FormData`, even with no image).

| Field | Required | Notes |
|---|---|---|
| `title` | yes | 1–200 chars |
| `organizationId` | yes | id from `GET /organizations` |
| `body` | one of `body`, `linkUrl`, `image` | up to 10,000 chars |
| `linkUrl` | | `http`/`https` URL |
| `image` | | file, jpeg/png/webp, max 5 MB |

- `201` → `{ "post": { ...post } }` with `"status": "pending"`
- `400 VALIDATION_ERROR` (with `fields`, e.g. `fields.organizationId`, `fields.image`; also when none of `body`, `linkUrl`, `image` is given)
- `403 SCHOOL_NOT_VERIFIED`, `403 PROFILE_INCOMPLETE`
- `429 RATE_LIMITED`

### GET `/posts?organization=BSCS&page=1` 🔒
The homepage list: approved posts from everyone, newest published first.
- `organization` (optional) is an organization `code`. Without it, all approved posts are listed. An unknown code returns `400`.
- `200` → `{ "items": [ ...PostSummary ], "page": 1, "pageSize": 20, "total": 57 }`

### GET `/posts/mine?status=pending&page=1` 🔒
The author's own posts, newest first, including pending and rejected ones with their `review`.
- `status` (optional): `pending`, `approved` or `rejected`.
- `200` → `{ "items": [ ...PostSummary ], "page": 1, "pageSize": 20, "total": 4 }`

### GET `/posts/:id` 🔒
- `200` → `{ "post": { ...post } }`
- `404 NOT_FOUND` (not visible to this user, or deleted)

### PATCH `/posts/:id` 🔒
Author only. `multipart/form-data` with any of `title`, `body`, `linkUrl`, `organizationId`, `image`, plus `removeImage=true` to remove the current image. Send `body=` (empty) or `linkUrl=` (empty) to clear them.
- `200` → `{ "post": { ...post } }` with `"status": "pending"`
- `400 VALIDATION_ERROR` (also "Nothing to update.")
- `403 FORBIDDEN` (not your post), `404 NOT_FOUND`

### DELETE `/posts/:id` 🔒
Author only (soft delete).
- `204`
- `403 FORBIDDEN` (not your post), `404 NOT_FOUND`

---

## 6. Moderation

Who moderates: the **President** and **Vice President** of each of the five departments. Admins can moderate every department.

Routing, again, because it matters: a post goes to the moderators of the department of the **author's registered course**. Example: a BS Computer Science student posts about teaching techniques tagged `BSED`; the post goes to the **Computer Science** department's moderators, not the Education ones.

Rules for reviewing:
- A moderator only sees and reviews posts of **their own department**. Admins see all.
- A moderator **cannot review their own post** (their department's other officer does, or an admin).
- Only `pending` posts can be reviewed (`409` otherwise).
- The reviewer may **correct the organization tag** while deciding.
- Every decision is stored: the moderator, the time, the tag before and after, and the optional note.

### GET `/moderation/posts?status=pending&page=1` 🔒🧑‍⚖️
The moderation queue.
- `status` is `pending` (default), `approved` or `rejected`. Pending is listed oldest first; others newest first.
- Moderators get their own department's posts. Admins get all departments and may add `&department=CS` (a department `code`) to filter.
- `200` → `{ "items": [ ...PostSummary with department and review ], "page": 1, "pageSize": 20, "total": 3 }`

### GET `/moderation/posts/:id` 🔒🧑‍⚖️
Full post (with `body`, `department` and `review`) for a post in the moderator's department.
- `200` → `{ "post": { ...post } }`
- `404 NOT_FOUND` (not in your department, or does not exist)

### PATCH `/moderation/posts/:id` 🔒🧑‍⚖️
```json
{ "decision": "approved", "organizationId": 5, "note": "Moved to BS Education, it is about teaching." }
```
- `decision`: `"approved"` or `"rejected"` (required).
- `organizationId` (optional): a corrected tag. If omitted, the tag stays.
- `note` (optional, up to 500 chars). Recommended for rejections: the author sees it.
- `200` → `{ "post": { ...post } }` with the new `status`
- `400 VALIDATION_ERROR`
- `403 FORBIDDEN` (other department, or your own post)
- `404 NOT_FOUND`
- `409 CONFLICT` (the post is not pending)

Approving sets `status: "approved"` and, the first time, `publishedAt`.

---

## 7. Admin: moderators

### GET `/admin/departments` 🔒🛡️
- `200`
```json
{
  "items": [
    {
      "id": 1, "code": "CS", "name": "Computer Science Department",
      "president": { "id": 7, "username": "cs_president", "displayName": "Juan Dela Cruz" },
      "vicePresident": null
    }
  ]
}
```

### PUT `/admin/departments/:departmentId/moderators/:office` 🔒🛡️
`:office` is `president` or `vice_president`. Assigns the person (replacing whoever held the office).
```json
{ "username": "cs_president" }
```
- `200` → the department entry, as in the list above
- `400 VALIDATION_ERROR` with `fields.username`: no such user, the account is not active, not email-verified, not school-verified, or their registered course does not belong to this department
- `404 NOT_FOUND` (department or office)
- `409 CONFLICT` (the user already holds another office)

### DELETE `/admin/departments/:departmentId/moderators/:office` 🔒🛡️
Vacates the office.
- `204`
- `404 NOT_FOUND`

Moderators can be a normal student account: their `role` stays `student`, and the `moderator` field on the `user` object says what they can do.

---

## Frontend pages this contract supports

| Page | Route | Endpoints |
|---|---|---|
| Register | `/register` | `GET /courses`, `POST /auth/register` |
| Login | `/login` | `POST /auth/login` |
| Verify email | `/verify-email?token=` | `POST /auth/verify-email`, `POST /auth/resend-verification` |
| Forgot password | `/forgot-password` | `POST /auth/forgot-password` |
| Reset password | `/reset-password?token=` | `POST /auth/reset-password` |
| Profile (view) | `/u/:username` | `GET /users/:username`, `GET /users/:username/posts` |
| Edit profile / settings | `/settings` | `PATCH /users/me`, `GET /courses`, avatar, `change-password`, `DELETE /users/me` |
| Get verified | `/settings/verification` | `POST /verification-requests`, `GET /verification-requests/me` |
| Homepage (all approved posts, filter by organization) | `/` | `GET /posts`, `GET /organizations` |
| Post detail | `/posts/:id` | `GET /posts/:id` |
| New / edit post | `/posts/new`, `/posts/:id/edit` | `POST /posts`, `PATCH /posts/:id`, `GET /organizations` |
| My posts (pending, approved, rejected) | `/my-posts` | `GET /posts/mine`, `DELETE /posts/:id` |
| Moderation queue | `/moderation` | `GET /moderation/posts`, `GET /moderation/posts/:id`, `PATCH /moderation/posts/:id`, `GET /organizations` |
| Admin: verification queue | `/admin/verifications` | the two `/admin/verification-requests` endpoints |
| Admin: moderators | `/admin/moderators` | `GET /admin/departments`, `PUT` and `DELETE .../moderators/:office` |

## Decisions

1. **Email verification** uses any active email (Gmail etc.). A verification link is emailed on registration and the user must click it before logging in.
2. **School verification** is separate: the user submits their school ID and an admin approves it. Only school-verified users can post.
3. **First admin:** register and verify a normal account, then run `node scripts/makeAdmin.js <username>` in the `server` folder. It is not created through the API.
4. **Organizations** are five fixed academic classifications (BS Computer Science, BS Criminology, BS Business Administration, BS Accountancy, BS Education), maintained by the system/admin. They are not communities: no membership, no groups, no separate spaces.
5. **Everyone sees all approved posts**, whatever their course. The homepage can be filtered by organization.
6. **Profile:** each user has a registered course, school year and year level, shown on hover over the author's name or picture. They never limit what a user can see.
7. **Media:** one image and/or one external link per post. No video or audio uploads.
8. **Mandatory moderation:** every post starts as `pending` and is hidden until approved.
9. **Moderators** are the President and Vice President of each of the five departments, routed by the **author's registered course**, not by the organization tag. The server decides; the client can't override it.
10. **Moderator powers:** approve, reject, and correct the organization tag. Every decision is recorded with the moderator, the time and an optional note.

### Assumptions to confirm (change this list when decided)

- **Viewing posts requires a login** (rule: "visible to every registered user").
- **Teachers** register a course (their department) and may post; they have no school year or year level.
- **School year** means the academic year, written `2026-2027`.
- **Editing an approved post** sends it back to `pending`.
- **Admins** can moderate every department as a fallback, and a moderator can't approve their own post.
- Course codes, department names and organization names in the seed data are placeholders; use the school's official ones.