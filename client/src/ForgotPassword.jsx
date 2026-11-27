import "./ForgotPassword.css";
import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "./auth";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      setError(err.message); // e.g. too many attempts (429)
    } finally {
      setSending(false);
    }
  }

  // After sending, show this instead of the form.
  if (sent) {
    return (
      <div className="forgot">
        <h1>Check your email</h1>
        <p>
          If an account with <strong>{email}</strong> exists, we sent a link to
          choose a new password. The link works for 1 hour, and only the newest
          link works.
        </p>
        <Link to="/login" className="btn">Back to Log In</Link>
      </div>
    );
  }

  return (
    <form className="forgot" onSubmit={handleSubmit}>
      <h1>Forgot Password</h1>
      <p>Enter your email and we'll send you a link to choose a new password.</p>
      <input type="email" placeholder="Email" value={email}
        onChange={(e) => setEmail(e.target.value)} required />
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={sending}>
        {sending ? "Sending..." : "Send reset link"}
      </button>
      <p><Link to="/login">Back to Log In</Link></p>
    </form>
  );
}

export default ForgotPassword;