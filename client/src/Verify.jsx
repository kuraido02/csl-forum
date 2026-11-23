import "./Auth.css";
import "./Profile.css";
import { useState } from "react";
import { Link } from "react-router-dom";
import { updateUser } from "./auth";

function Verify({ user, setUser }) {
    const [message, setMessage] = useState("");

    function fakeClickLink() {
        const updated = updateUser(user.id, { email: { Verified: true } });
        setUser(updated);
    }

    if (user.email.Verified) {
        return (
            <div className="auth">
                <h1>Email Verified</h1>
                <p>Your email {user.email} has been verified.</p>
                <Link className="btn" to="/profile">Go to Profile</Link>
            </div>
        );
    }

    return (
        <div className="auth">
            <h1>Verify Your Email</h1>
            <p>We sent a verification link to <b>{user.email}</b>.</p>

            {message && <p className="success">{message}</p>}

            <button className="btn" onClick={() => setMessage("Email sent again.")}>Resend email</button>
            <p><Link to="/settings">Change Email</Link></p>

            <div> className="note"
                Demo: no real email is sent.{" "}
                <button className="btn" onClick={fakeClickLink}>Click here to verify</button>
            </div>
        </div>
    );
}

export default Verify;
