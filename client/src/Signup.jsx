import "./Auth.css";
import { useState } from "react";
import { Link } from "react-router-dom";
import { signup } from "./auth";

function Signup() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  

  function handleSubmit(e) {
    e.preventDefault();

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    const result = signup( name, username, email.toLowerCase(), password, role);

    if (result.error) {
      setError(result.error);
      return;
    }

    setUser(result.user);
    navigate("/verify");
  }

  return (
    <form className="auth" onSubmit={handleSubmit}>
      <h1>Sign Up</h1>
      <input placeholder="Full Name" value={name}
        onChange={(e) => setName(e.target.value)} required />
      <input placeholder="Username" value={username}
        onChange={(e) => setUsername(e.target.value)} required />
      <input type="email" placeholder="Email" value={email}
        onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password}
        onChange={(e) => setPassword(e.target.value)} required />
      <input type="password" placeholder="Confirm Password" value={confirm}
        onChange={(e) => setConfirm(e.target.value)} required />

      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="student">Student</option>
        <option value="instructor">Instructor</option>
      </select>

      {error && <p className="error">{error}</p>}
      
      <button className="btn">Sign Up</button>
      <p>Already a member? <Link to="/login">Log In</Link></p>
    </form>
  );
}

export default Signup;