function getUsers() {
  const text = localStorage.getItem("users");
  return text ? JSON.parse(text) : [];
}

function saveUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
}

export function getCurrentUser() {
  const id = localStorage.getItem("currentUserId");
  return getUsers().find((u) => u.id === id) || null;
}

export function signup(name, username, email, password, role) {
  const users = getUsers();

  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return { error: "That username is taken." };
  }
  if (users.some((u) => u.email === email)) {
    return { error: "An account with this email already exists." };
  }

  const newUser = {
    id: String(Date.now()),
    name: name,
    username: username,
    email: email,
    password: password,
    role: role,
    bio: "",
    avatar: "",
    school: "",
    schoolEmail: "",
    emailVerified: false,
    schoolVerified: false,
    teacherStatus: "none",
    created: new Date().toISOString(),
  };

  saveUsers([...users, newUser]);
  localStorage.setItem("currentUserId", newUser.id);
  return { user: newUser };
}

export function login(emailOrUsername, password) {
  const text = emailOrUsername.trim().toLowerCase();
  const user = getUsers().find(
    (u) => (u.email === text || u.username.toLowerCase() === text) && u.password === password
  );

  if (!user) return { error: "Email, username or password is incorrect." };

  localStorage.setItem("currentUserId", user.id);
  return { user: user };
}

export function logout() {
  localStorage.removeItem("currentUserId");
}

export function updateUser(id, changes) {
  const users = getUsers();
  const updated = users.map((u) => (u.id === id ? { ...u, ...changes } : u));
  saveUsers(updated);
  return updated.find((u) => u.id === id);
}

export function emailExists(email) {
  return getUsers().some((u) => u.email === email);
}

export function emailTakenByOther(email, myId) {
  return getUsers().some((u) => u.email === email && u.id !== myId);
}

export function resetPassword(email, newPassword) {
  const users = getUsers().map((u) => (u.email === email ? { ...u, password: newPassword } : u));
  saveUsers(users);
}

export function deleteUser(id) {
  saveUsers(getUsers().filter((u) => u.id !== id));
  logout();
}