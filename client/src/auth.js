const API = "http://localhost:3000/api";

// One helper that every call goes through.
async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      credentials: "include", // send the login cookie every time
      ...options,
    });
  } catch {
    // fetch only throws when the server can't be reached at all
    throw { code: "NETWORK", message: "Cannot reach the server. Is it running?" };
  }

  if (res.status === 204) return null; // 204 = success with no body

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // The backend always answers errors as { error: { code, message, fields? } }
    throw data?.error || { code: "SERVER_ERROR", message: "Something went wrong." };
  }
  return data;
}

// Sends a JSON body.
function postJson(path, body) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Asks the server who is logged in. Returns the user, or null.
export async function getCurrentUser() {
  try {
    const data = await request("/auth/me");
    return data.user;
  } catch {
    return null; // 401 or server down: show the logged-out UI
  }
}

export async function login(identifier, password) {
  const data = await postJson("/auth/login", { identifier, password });
  return data.user;
}

export async function logout() {
  await request("/auth/logout", { method: "POST" });
}

export async function signup(fields) {
  const data = await postJson("/auth/register", fields);
  return data.user;
}

// Gets the 5 courses for the sign-up dropdown (no login needed).
export async function getCourses() {
  const data = await request("/courses");
  return data.items;
}

// Confirms the email using the token from the link in the email.
export async function verifyEmail(token) {
  await postJson("/auth/verify-email", { token });
}

// Asks for a new verification link. The server always answers the same message.
export async function resendVerification(email) {
  await postJson("/auth/resend-verification", { email });
}

// Sets a new password using the token from the reset-password email.
export async function resetPassword(token, newPassword) {
  await postJson("/auth/reset-password", { token, newPassword });
}

// Sends a school verification request (school ID number + optional note).
export async function submitVerificationRequest(schoolIdNumber, note) {
  const body = { schoolIdNumber };
  if (note) body.note = note; // the note is optional: leave it out when empty
  const data = await postJson("/verification-requests", body);
  return data.request; // { id, status: "pending", createdAt }
}

// Gets the latest request of the logged-in user, or null if never sent.
export async function getMyVerificationRequest() {
  const data = await request("/verification-requests/me");
  return data.request;
}

// Saves only the profile fields that changed (displayName, bio, courseId, schoolYear, yearLevel).
export async function updateProfile(changes) {
  const data = await request("/users/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  return data.user;
}

// Uploads a photo as a multipart form. Returns the new avatarUrl.
// No Content-Type header here: the browser adds it, with the boundary.
export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append("avatar", file); // the field name must be "avatar"
  const data = await request("/users/me/avatar", { method: "POST", body: formData });
  return data.avatarUrl;
}

// Removes the photo (the profile goes back to the default avatar).
export async function removeAvatar() {
  await request("/users/me/avatar", { method: "DELETE" });
}

// Changes the password of the logged-in user.
// Errors come back as fields.currentPassword or fields.newPassword.
export async function changePassword(currentPassword, newPassword) {
  await postJson("/auth/change-password", { currentPassword, newPassword });
}

// Deletes the account (soft delete). The password is sent in the body.
// On success the server answers 204 and clears the login cookie.
export async function deleteAccount(password) {
  await request("/users/me", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
}

export async function forgotPassword(email) {
  await postJson("/auth/forgot-password", { email });
}

