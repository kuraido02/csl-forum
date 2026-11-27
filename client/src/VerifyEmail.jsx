import "./VerifyEmail.css";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmail, resendVerification } from "./auth";

function VerifyEmail() {
  // Reads ?token=... from the address bar.
  const [params] = useSearchParams();
  const token = params.get("token");

  // status is "loading", "success" or "error".
  const [status, setStatus] = useState(token ? "loading" : "error");
  const [message, setMessage] = useState(
    token ? "" : "This link has no token. Please use the link from your email."
  );

  // A ref keeps its value even when React runs the effect twice in development.
  const started = useRef(false);

  // State for the "send me a new link" form.
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState("");

  useEffect(() => {
    if (!token || started.current) return; // no token, or already asked once
    started.current = true;

    verifyEmail(token)
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setMessage(
          err.code === "TOKEN_INVALID"
            ? "This link is invalid, already used, or expired."
            : err.message
        );
      });
  }, [token]);

  async function handleResend(e) {
    e.preventDefault();
    setResendError("");
    setSending(true);
    try {
      await resendVerification(email.trim().toLowerCase());
      setResent(true);
    } catch (err) {
      setResendError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="verify-email">
        <h1>Verifying...</h1>
        <p>Sandali lang, checking your link.</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="verify-email">
        <h1>Email verified!</h1>
        <p>Salamat! Your account is ready. You can log in now.</p>
        <Link to="/login" className="btn">Go to Log In</Link>
      </div>
    );
  }

  // status === "error"
  return (
    <div className="verify-email">
      <h1>Link problem</h1>
      <p className="error">{message}</p>
      <p>Already verified? <Link to="/login">Log In</Link></p>

      {resent ? (
        <p className="success">
          If the account exists, a new link was sent. Check your email.
        </p>
      ) : (
        <form onSubmit={handleResend}>
          <p className="hint">Need a new link? Enter your email.</p>
          <input type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          {resendError && <p className="error">{resendError}</p>}
          <button className="btn" disabled={sending}>
            {sending ? "Sending..." : "Send a new link"}
          </button>
        </form>
      )}
    </div>
  );
}

export default VerifyEmail;