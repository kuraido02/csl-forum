# CSL Forum — API Contract (Phase 1)

Shared agreement between **backend (server/)** and **frontend (client/)**.
If an endpoint changes, update this file in the same pull request.

## Conventions

- Base URL (dev): `http://localhost:3000/api`
- All request/response bodies are JSON, except avatar upload (`multipart/form-data`).
- JSON keys are **camelCase**. (Database columns are snake_case; the backend converts.)
- Dates are ISO 8601 strings in UTC, e.g. `"2026-11-04T09:30:00.000Z"`.
- **Auth uses an httpOnly cookie** named `token`, set by the server on login.
  - Frontend must send `credentials: "include"` on every request (fetch) or `withCredentials: true` (axios).
  - Server CORS allows origin `http://localhost:5173` with credentials.
  - The frontend cannot read the cookie. To know who is logged in, call `GET /auth/me`.
- 🔒 = login required (returns `401 UNAUTHENTICATED` when not logged in). 🛡️ = admin only (returns `403 FORBIDDEN` for everyone else).

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
| 403 | `FORBIDDEN` | Logged in but not allowed (e.g. not admin) |
| 403 | `EMAIL_NOT_VERIFIED` | Login blocked until the email is verified |
| 403 | `ACCOUNT_BANNED` | Account is banned |
| 404 | `NOT_FOUND` | Thing doesn't exist |
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
| `program` | up to 50 chars |
| `yearLevel` | integer 1–4 |
| `avatar` | image/jpeg, image/png, image/webp; max 2 MB |
| `role` (signup) | `"student"` or `"teacher"` |
| `schoolIdNumber` | up to 30 chars. Only sent in a verification request; read-only everywhere else |

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
    "program": "BSCS",
    "yearLevel": 4
  }
}
```

`email` and `schoolIdNumber` are **only** returned to the account owner (and to admins in the verification list). Other users get the public profile below.
`avatarUrl` is `null` when the user has no avatar. Show it as `http://localhost:3000` + `avatarUrl`.

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
  "role": "student"
}
```
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
Public profile of any user (login not required in Phase 1).
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
      "program": "BSCS",
      "yearLevel": 4
    }
  }
}
```
- `404 NOT_FOUND` (also for deleted users and for users who haven't verified their email)

### PATCH `/users/me` 🔒
Edit profile. Send only the fields you want to change. Send `null` or `""` to clear `bio` or `program`.
```json
{
  "displayName": "Ivan Clyd T. Suello",
  "bio": "Web dev student",
  "program": "BSCS",
  "yearLevel": 4
}
```
- `200` → `{ "user": { ...user } }`
- `400 VALIDATION_ERROR` (also "Nothing to update." when no field is sent)

`schoolIdNumber` can't be edited here. It is set when an admin approves a verification request.

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
- `204` and the cookie is cleared. The account is soft-deleted: username and email are freed, profile data is erased.
- `400 VALIDATION_ERROR` with `fields.password` (wrong password)
- `403 FORBIDDEN` (admin accounts can't be deleted here)

### GET `/users/:username/posts`  *(stub until Phase 2)*
### GET `/users/:username/comments`  *(stub until Phase 3)*
Return the list shape below so the profile tabs can be built now.
Until those phases exist they return an empty list:
```json
{ "items": [], "page": 1, "pageSize": 20, "total": 0 }
```
- `404 NOT_FOUND` (same rule as the public profile)

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

## Frontend pages this contract supports

| Page | Route | Endpoints |
|---|---|---|
| Register | `/register` | `POST /auth/register` |
| Login | `/login` | `POST /auth/login` |
| Verify email | `/verify-email?token=` | `POST /auth/verify-email`, `POST /auth/resend-verification` |
| Forgot password | `/forgot-password` | `POST /auth/forgot-password` |
| Reset password | `/reset-password?token=` | `POST /auth/reset-password` |
| Profile (view) | `/u/:username` | `GET /users/:username`, posts/comments stubs |
| Edit profile / settings | `/settings` | `PATCH /users/me`, avatar, `change-password`, `DELETE /users/me` |
| Get verified | `/settings/verification` | `POST /verification-requests`, `GET /verification-requests/me` |
| Admin: verification queue | `/admin/verifications` | the two `/admin/...` endpoints |

## Decisions

1. **Email verification** uses any active email (Gmail etc.). A verification link is emailed on registration and the user must click it before logging in.
2. **School verification** is separate: the user submits their school ID and an admin approves it. Until then the user can read but not post or comment.
3. **First admin account:** register and verify a normal account, then run `node scripts/makeAdmin.js <username>` in the `server` folder. It is not created through the API.