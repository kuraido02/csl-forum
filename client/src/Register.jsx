
import { useState } from "react";
import "./Register.css";

function Register({ onSwitchToLogin }) {

  // State declarations
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Register function
  const handleRegister = (e) => {
    e.preventDefault();

    // Check empty fields
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      setSuccess("");
      return;
    }

    // Check password length
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setSuccess("");
      return;
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setSuccess("");
      return;
    }

    // Get existing accounts
    const accounts = JSON.parse(localStorage.getItem("accounts") || "[]");

    // Check existing username or email
    const existingAccount = accounts.find(
      (account) =>
        account.username.toLowerCase() === username.trim().toLowerCase() ||
        account.email.toLowerCase() === email.trim().toLowerCase()
    );

    if (existingAccount) {
      setError("Username or email is already registered.");
      setSuccess("");
      return;
    }

    // Create new account
    const newAccount = {
      username: username.trim(),
      email: email.trim(),
      password: password
    };

    // Save account
    accounts.push(newAccount);
    localStorage.setItem("accounts", JSON.stringify(accounts));

    // Clear form
    setUsername("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");

    setError("");
    setSuccess("Account registered successfully!");
  };

  return (
    <div className="register-container">
      <div className="register-box">

        <h2>Create Account</h2>
        <p>Register your account</p>

        <form onSubmit={handleRegister}>

          <label>Username</label>
          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <label>Email</label>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <label>Confirm Password</label>
          <input
            type="password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}

          <button type="submit">
            Register
          </button>

        </form>

        <p className="switch-login">
          Already have an account?{" "}
          <button type="button" onClick={onSwitchToLogin}>
            Login
          </button>
        </p>

      </div>
    </div>
  );
}

export default Register;
