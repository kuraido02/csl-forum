
import { useState } from "react";
import "./Login.css";

function Login({ onSwitchToRegister }) {

 const [username, setUsername] = useState("");
const [password, setPassword] = useState("");

const [loggedInUser, setLoggedInUser] = useState(() => {
  return sessionStorage.getItem("username") || "";
});

const [error, setError] = useState("");



  // Login function
  const handleLogin = (e) => {
    e.preventDefault();

    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }

    sessionStorage.setItem("username", username);

    setLoggedInUser(username);
    setUsername("");
    setPassword("");
    setError("");
  };

  // Logout function
  const handleLogout = () => {
    sessionStorage.removeItem("username");
    setLoggedInUser("");
    setError("");
  };

  // Logged-in interface
  if (loggedInUser) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h2>Welcome!</h2>
          <p>You are logged in as:</p>
          <h3>{loggedInUser}</h3>

          <button onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    );
  }

  // Login interface
  return (
    <div className="login-container">
      <div className="login-box">

        <h2>Login</h2>
        <p>Enter your account details</p>

        <form onSubmit={handleLogin}>

          <label>Username</label>
          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="error">{error}</p>}

          <button type="submit">
            Login
          </button>

        </form>
<p className="switch-register">
  Don't have an account?{" "}
  <span onClick={onSwitchToRegister}>
    Register
  </span>
</p>
       
      </div>
    </div>
  );
}

export default Login;
