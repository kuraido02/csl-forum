import "./Login.css";
import { useState } from "react";
import { Link } from "react-router-dom";
import { login } from "./auth";

function Login({ setUser }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();

    const result = login({ email, password });
    if (result.error) {
      setError(result.error);
      return;
    } 

      setUser(result.user);
      navigate("/profile");
    }

  return (
    <form className="login" onSubmit={handleSubmit}>
      <h1>Log In</h1>
      <input type="email" placeholder="Username or Email" value={email}
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