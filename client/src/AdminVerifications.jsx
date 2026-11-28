import "./AdminVerifications.css";
import { useState, useEffect } from "react";
import { getVerificationRequests, reviewVerificationRequest } from "./auth";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

function AdminVerifications() {
  const [status, setStatus] = useState("pending"); // the selected tab
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pageSize: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Which request is being rejected right now, and the reason being typed.
  const [rejectingId, setRejectingId] = useState(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState(null); // request being sent to the server

  // Asks the server for the current tab and page.
  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await getVerificationRequests(status, page);
      // If the last request on page 2 was just reviewed, go back to page 1.
      if (result.items.length === 0 && page > 1) {
        setPage(page - 1);
        return;
      }
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Runs when the page opens, and again whenever the tab or page changes.
  useEffect(() => {
    load();
  }, [status, page]);

  function changeTab(key) {
    setStatus(key);
    setPage(1);
    cancelReject();
  }

  function startReject(id) {
    setRejectingId(id);
    setReason("");
    setError("");
  }

  function cancelReject() {
    setRejectingId(null);
    setReason("");
  }

  async function review(id, decision) {
    setError("");

    if (decision === "rejected" && !reason.trim()) {
      setError("Write a reason, so the student knows what to fix.");
      return;
    }

    setBusyId(id);
    try {
      await reviewVerificationRequest(id, decision, reason.trim());
      cancelReject();
      await load(); // the request leaves this tab
    } catch (err) {
      setError(err.fields?.rejectReason || err.message);
      // "already reviewed" and similar: refresh so the list matches the server
      if (err.code === "CONFLICT") await load();
    } finally {
      setBusyId(null);
    }
  }

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <main className="admin-v">
      <h1>School Verification Requests</h1>

      <div className="av-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={status === t.key ? "active" : ""}
            onClick={() => changeTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      {loading && <p className="av-empty">Loading...</p>}

      {!loading && data.items.length === 0 && (
        <p className="av-empty">Wala pang requests dito.</p>
      )}

      {!loading && data.items.map((r) => (
        <div className="av-card" key={r.id}>
          <div className="av-head">
            <strong>{r.user.displayName}</strong>
            <span className="username">u/{r.user.username}</span>
            <span className="av-role">{r.user.role}</span>
          </div>

          <p>Email: {r.user.email}</p>
          <p>School ID: <strong>{r.schoolIdNumber}</strong></p>
          {r.note && <p>Note: {r.note}</p>}
          <small>Sent {new Date(r.createdAt).toLocaleString()}</small>

          {r.status === "rejected" && r.rejectReason && (
            <p className="error">Reason: {r.rejectReason}</p>
          )}

          {/* Only pending requests can be reviewed */}
          {r.status === "pending" && rejectingId !== r.id && (
            <div className="av-actions">
              <button className="btn" disabled={busyId === r.id}
                onClick={() => review(r.id, "approved")}>
                {busyId === r.id ? "Working..." : "Approve"}
              </button>
              <button className="btn outline" disabled={busyId === r.id}
                onClick={() => startReject(r.id)}>
                Reject
              </button>
            </div>
          )}

          {r.status === "pending" && rejectingId === r.id && (
            <>
              <textarea placeholder="Reason for rejecting (the student sees this)"
                value={reason} maxLength={500} rows={3}
                onChange={(e) => setReason(e.target.value)} />
              <div className="av-actions">
                <button className="btn danger" disabled={busyId === r.id}
                  onClick={() => review(r.id, "rejected")}>
                  {busyId === r.id ? "Working..." : "Confirm reject"}
                </button>
                <button className="btn outline" onClick={cancelReject}
                  disabled={busyId === r.id}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {!loading && data.total > data.pageSize && (
        <div className="av-pager">
          <button className="btn outline" disabled={page <= 1}
            onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button className="btn outline" disabled={page >= pages}
            onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </main>
  );
}

export default AdminVerifications;