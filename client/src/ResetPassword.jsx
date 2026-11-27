import "./ForgotPassword.css";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "./auth";
import PasswordInput from "./PasswordInput";

function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token"); // from ?token=... in the address

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [tokenBad, setTokenBad] = useState(!token); // no token = bad link
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Same rule as the contract: 8+ characters, at least 1 letter and 1 number.
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password needs at least 8 characters, with a letter and a number.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      if (err.code === "TOKEN_INVALID") {
        setTokenBad(true); // the link is wrong, used, or expired
      } else {
        // e.g. a weak password: the link is still valid, so the user can try again
        setError(err.fields?.newPassword || err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="forgot">
        <h1>Password updated!</h1>
        <p>Salamat! You can log in with your new password now.</p>
        <Link to="/login" className="btn">Go to Log In</Link>
      </div>
    );
  }

  if (tokenBad) {
    return (
      <div className="forgot">
        <h1>Link problem</h1>
        <p className="error">This link is invalid, already used, or expired.</p>
        <Link to="/forgot-password" className="btn">Get a new link</Link>
      </div>
    );
  }

  return (
    <form className="forgot" onSubmit={handleSubmit}>
      <h1>Choose a New Password</h1>
      <PasswordInput placeholder="New Password" value={password}
        onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
      <PasswordInput placeholder="Confirm New Password" value={confirm}
        onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={saving}>
        {saving ? "Saving..." : "Reset Password"}
      </button>
    </form>
  );
}

export default ResetPassword;