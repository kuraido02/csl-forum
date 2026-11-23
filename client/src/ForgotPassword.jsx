import "./Auth.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { emailExists, forgotPassword } from "./auth";

function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [step, setStep] = useState(1);
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    function handleSendLink(e) {
        e.preventDefault();
        if (!emailExists(email.toLowerCase())) {
            setError("Email not found.");
            return;
        }
        setError("");
        setStep(2);
    }

    function handleNewPassword(e) {
        e.preventDefault();
        if (password.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }
        if (password !== confirm) {
            setError("Passwords do not match.");
            return;
        }
        resetPassword(email.toLowerCase(), password);
        navigate("/login");
    }

    if (step === 1) {
        return (
            <form className="auth" onSubmit={handleSendLink}>
                <h1>Forgot Password</h1>
                <p>We'll send you a link to choose a new password.</p>
                <input type="email" placeholder="Email" value={email}
                    onChange={(e) => setEmail(e.target.value)} required />
                {error && <p className="error">{error}</p>}
                <button className="btn">Send reset link</button>
                <p><Link to="/login">Back to Log In</Link></p>
            </form>
        );
    }

    return (
        <form className="auth" onSubmit={handleNewPassword}>
            <h1>Choose a New Password</h1>
            <input type="password" placeholder="New Password" value={password}
                onChange={(e) => setPassword(e.target.value)} required />
            <input type="password" placeholder="Confirm New Password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} required />
            {error && <p className="error">{error}</p>}
            <button className="btn">Reset Password</button>
        </form>
    );
}

export default ForgotPassword;