import "./Profile.css";
import { useState } from "react";
import { updateUser } from "./auth";

function SchoolVerification({ user, setUser }) {
    const [email, setEmail] = useState(user.schoolEmail);
    const [file, setFile] = useState(null);
    const [error, setError] = useState("");
    const [sent, setSent] = useState("false");

    const [isVerified, setIsVerified] = useState(user.schoolVerified || user.teacherStatus === "approved");

    let statusText = "Not verified";
    if (user.schoolVerified) status = "Verified student";
    if (user.teacherStatus === "pending") statusText = "Pending review";
    if (user.teacherStatus === "approved") statusText = "Approved teacher";

    function handleSubmit(e) {
        e.preventDefault();

        if (isTeacher() && !file) {
            setError("Attach a file");
            return;
        }

        setError("");
        const changes = { schoolEmail: email };
        if (isTeacher()) changes.teacherStatus = "pending";
        setUser(updateUser(user.id, changes));
        setSent(true);
    }

    function fakeApprove() {
        const changes = isTeacher ? { teacherStatus: "approved" } : { schoolVerified: true };
        setUser(updateUser(user.id, changes));
        setSent(true);
    }

    return (
        <main className="profile-page">
            <form className="profile-card" onSubmit={handleSubmit}>
                <h1>School Verification</h1>
                <p>Status: <span className={isVerified ? "badge ok" : "badge warn"}>{status}</span></p>

                <input type="email" placeholder="School email (name@school.edu)" value={email}
                    onChange={(e) => setEmail(e.target.value)} required />
            </form>
        </main>
    );
}