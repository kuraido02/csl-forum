import "./Profile.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PasswordInput from "./PasswordInput";
import { changePassword, deleteAccount } from "./auth";

// Shows a red message under an input, only if there is one.
function FieldError({ message }) {
  return message ? <p className="field-error">{message}</p> : null;
}

function Settings({ user, setUser }) {
  const navigate = useNavigate();

  // ----- Change password -----
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwFieldErrors, setPwFieldErrors] = useState({});
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  async function handlePassword(e) {
    e.preventDefault();
    setPwError("");
    setPwFieldErrors({});
    setPwSuccess(false);

    // The same rules as the contract. The server checks them again anyway.
    const problems = {};
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      problems.newPassword = "At least 8 characters, with a letter and a number.";
    } else if (newPassword === currentPassword) {
      problems.newPassword = "The new password must be different from the current one.";
    }
    if (newPassword !== confirm) problems.confirm = "Passwords don't match.";
    if (Object.keys(problems).length > 0) {
      setPwFieldErrors(problems);
      return;
    }

    setPwSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setPwSuccess(true);
    } catch (err) {
      if (err.fields) setPwFieldErrors(err.fields); // e.g. "wrong current password"
      else setPwError(err.message);
    } finally {
      setPwSaving(false);
    }
  }

  // ----- Delete account -----
  const [confirming, setConfirming] = useState(false); // is the delete form open?
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  function cancelDelete() {
    setConfirming(false);
    setDeletePassword("");
    setDeleteError("");
  }

  async function handleDelete(e) {
    e.preventDefault();
    setDeleteError("");
    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
      setUser(null); // the cookie is already cleared by the server
      navigate("/");
    } catch (err) {
      setDeleteError(err.fields?.password || err.message);
      setDeleting(false);
    }
  }

  return (
    <main className="profile-page">
      <form className="profile-card" onSubmit={handlePassword}>
        <h2>Change password</h2>

        <PasswordInput placeholder="Current password" value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)} required
          autoComplete="current-password" />
        <FieldError message={pwFieldErrors.currentPassword} />

        <PasswordInput placeholder="New password (8+ characters)" value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)} required
          autoComplete="new-password" />
        <FieldError message={pwFieldErrors.newPassword} />

        <PasswordInput placeholder="Confirm new password" value={confirm}
          onChange={(e) => setConfirm(e.target.value)} required
          autoComplete="new-password" />
        <FieldError message={pwFieldErrors.confirm} />

        {pwError && <p className="error">{pwError}</p>}
        {pwSuccess && <p className="success">Salamat! Your password was updated.</p>}

        <div className="row">
          <button className="btn" disabled={pwSaving}>
            {pwSaving ? "Saving..." : "Save password"}
          </button>
        </div>
      </form>

      <div className="profile-card danger-zone">
        <h2>Delete account</h2>

        {!confirming && (
          <>
            <p>This permanently removes your profile and frees your username and email.</p>
            <div className="row">
              <button type="button" className="btn danger" onClick={() => setConfirming(true)}>
                Delete account
              </button>
            </div>
          </>
        )}

        {confirming && (
          <form onSubmit={handleDelete}>
            <p>
              <strong>This cannot be undone.</strong> Your profile data is erased,
              and your pending and rejected posts are removed. Your approved posts
              stay, shown as written by [deleted]. If you are a moderator, your
              office becomes vacant.
            </p>
            <PasswordInput placeholder="Type your password to confirm" value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)} required
              autoComplete="current-password" />
            {deleteError && <p className="error">{deleteError}</p>}
            <div className="row">
              <button className="btn danger" disabled={deleting}>
                {deleting ? "Deleting..." : "Yes, delete my account"}
              </button>
              <button type="button" className="btn outline" onClick={cancelDelete}
                disabled={deleting}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

export default Settings;