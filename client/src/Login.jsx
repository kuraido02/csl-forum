import "./Login.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "./auth";

function Login({ setUser }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const user = await login(email, password);
      setUser(user);
      navigate("/profile");
    } catch (err) {
      setError(err.message); // the server's message, e.g. wrong password
    }
  }

  return (
    <form className="login" onSubmit={handleSubmit}>
      <h1>Log In</h1>
      <input type="text" placeholder="Username or Email" value={email}
        onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password}
        onChange={(e) => setPassword(e.target.value)} required />

      {error && <p className="error">{error}</p>}

      <button className="btn">Log In</button>
      <p><Link to="/forgot-password">Forgot Password?</Link></p>
      <p>Don't have an account yet? <Link to="/signup">Sign Up</Link></p>
    </form>
  );
}

export default Login;