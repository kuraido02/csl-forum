import "./Profile.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateUser, deleteUser, emailTakenByOther } from "./auth";

function Settings({ user, setUser }) {
  const [email, setEmail] = useState(user.email);
  const [emailMessage, setEmailMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const navigate = useNavigate();

  function handleEmail(e) {
    e.preventDefault();
    const newEmail = email.toLowerCase();

    if (emailTakenByOther(newEmail, user.id)) {
      setEmailMessage("That email is already in use.");
      return;
    }

    setUser(updateUser(user.id, { email: newEmail, emailVerified: false }));
    navigate("/verify");
  }

  function handlePassword(e) {
    e.preventDefault();

    if (currentPassword !== user.password) {
      setPasswordMessage("Current password is incorrect.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setPasswordMessage("Passwords don't match.");
      return;
    }

    setUser(updateUser(user.id, { password: newPassword }));
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
    setPasswordMessage("Password updated.");
  }

  function handleDelete() {
    // window.confirm shows a simple "OK / Cancel" box
    if (window.confirm("Delete your account? This cannot be undone.")) {
      deleteUser(user.id);
      setUser(null);
      navigate("/signup");
    }
  }

  return (
    <main className="profile-page">
      <form className="profile-card" onSubmit={handleEmail}>
        <h2>Change email</h2>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {emailMessage && <p className="error">{emailMessage}</p>}
        <div className="row"><button className="btn">Save email</button></div>
      </form>

      <form className="profile-card" onSubmit={handlePassword}>
        <h2>Change password</h2>
        <input type="password" placeholder="Current password" value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)} required />
        <input type="password" placeholder="New password (8+ characters)" value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)} required />
        <input type="password" placeholder="Confirm new password" value={confirm}
          onChange={(e) => setConfirm(e.target.value)} required />
        {passwordMessage && <p className={passwordMessage === "Password updated." ? "success" : "error"}>{passwordMessage}</p>}
        <div className="row"><button className="btn">Save password</button></div>
      </form>

      <div className="profile-card danger-zone">
        <h2>Delete account</h2>
        <p>This permanently removes your profile.</p>
        <div className="row"><button className="btn danger" onClick={handleDelete}>Delete account</button></div>
      </div>
    </main>
  );
}

export default Settings;