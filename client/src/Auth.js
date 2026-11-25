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

export async function forgotPassword(email) {
  await postJson("/auth/forgot-password", { email });
}

// TEMPORARY: the backend has no endpoint for these two.
// They exist only so the pages that import them can load.
export async function emailExists() {
  throw { code: "NOT_AVAILABLE", message: "emailExists has no backend endpoint." };
}
export async function updateUser() {
  throw { code: "NOT_AVAILABLE", message: "updateUser has no backend endpoint." };
}

// TEMPORARY: Settings.jsx imports these, the backend needs other endpoints for them.
export async function deleteUser() {
  throw { code: "NOT_AVAILABLE", message: "deleteUser is not connected yet." };
}
export async function emailTakenByOther() {
  throw { code: "NOT_AVAILABLE", message: "emailTakenByOther has no backend endpoint." };
}