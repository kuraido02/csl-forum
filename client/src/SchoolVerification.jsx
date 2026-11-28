import "./SchoolVerification.css";
import { useState, useEffect } from "react";
import {
  getCurrentUser,
  getMyVerificationRequest,
  submitVerificationRequest,
} from "./auth";

// Shows a red message under an input, only if there is one.
function FieldError({ message }) {
  return message ? <p className="field-error">{message}</p> : null;
}

function SchoolVerification({ user, setUser }) {
  const [request, setRequest] = useState(null); // the latest request, or null
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Asks the server for the latest request.
  async function loadRequest() {
    try {
      const r = await getMyVerificationRequest();
      setRequest(r);
      // An admin approved it after the last login: refresh the user,
      // so the rest of the app also knows schoolVerified is now true.
      if (r?.status === "approved" && !user.schoolVerified) {
        setUser(await getCurrentUser());
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Runs once when the page opens.
  useEffect(() => {
    loadRequest();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    if (!schoolId.trim()) {
      setFieldErrors({ schoolIdNumber: "Enter your school ID number." });
      return;
    }

    setSubmitting(true);
    try {
      const r = await submitVerificationRequest(schoolId.trim(), note.trim());
      setRequest(r); // now "pending", so the form disappears
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fields || {}); // e.g. the ID is used by another account
      // "already pending" or "already verified": ask again, so the page matches the server
      if (err.code === "CONFLICT" && !err.fields?.schoolIdNumber) loadRequest();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="school-loading">Loading...</p>;

  // Decide the badge from the user and the latest request.
  const verified = user.schoolVerified || request?.status === "approved";
  const pending = !verified && request?.status === "pending";
  const rejected = !verified && request?.status === "rejected";

  let badge = { text: "Not verified", cls: "warn" };
  if (verified) badge = { text: "Verified", cls: "ok" };
  else if (pending) badge = { text: "Pending review", cls: "warn" };
  else if (rejected) badge = { text: "Rejected", cls: "bad" };

  return (
    <main className="school">
      <h1>School Verification</h1>
      <p>Status: <span className={"badge " + badge.cls}>{badge.text}</span></p>

      {verified && (
        <p>Salamat! Your account is verified with your school.</p>
      )}

      {pending && (
        <p>
          We got your request on{" "}
          {new Date(request.createdAt).toLocaleDateString()}. An admin will
          review it soon.
        </p>
      )}

      {rejected && (
        <p className="error">
          Your last request was rejected: {request.rejectReason}
        </p>
      )}

      {!verified && !pending && (
        <form onSubmit={handleSubmit}>
          <p className="hint">
            Enter your school ID number. An admin checks it against the school list.
          </p>

          <input placeholder="School ID number (e.g. 2022-00123)" value={schoolId}
            maxLength={30} onChange={(e) => setSchoolId(e.target.value)} required />
          <FieldError message={fieldErrors.schoolIdNumber} />

          <textarea placeholder="Note for the admin (optional), e.g. BSCS 4th year, Section A"
            value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          <FieldError message={fieldErrors.note} />

          {error && <p className="error">{error}</p>}

          <button className="btn" disabled={submitting}>
            {submitting ? "Sending..." : rejected ? "Send a new request" : "Send request"}
          </button>
        </form>
      )}

      {/* Errors while loading the status, when the form is not shown */}
      {error && (verified || pending) && <p className="error">{error}</p>}
    </main>
  );
}

export default SchoolVerification;