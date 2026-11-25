import "./Navbar.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SearchBar from "./SearchBar";
import { logout } from "./auth";
import useTheme from "./useTheme";

function Navbar({ user, setUser }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  async function handleLogout() {
    await logout(); // tells the server to clear the cookie
    setUser(null);
    setMenuOpen(false);
    navigate("/login");
  }

  return (
    <header className="tv-nav">
      <div className="tv-nav-inner">
        <Link to="/" className="tv-logo" aria-label="TALAVYN home">
          <img src="/talavyn-logo-white.png" alt="TALAVYN" />
        </Link>

        <div className="tv-search">
          <SearchBar />
        </div>

        <div className="tv-actions">
          <button
            className="tv-icon-btn"
            onClick={toggleTheme}
            aria-label="Switch between light and dark mode"
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>

          {!user && (
            <>
              <Link to="/login" className="tv-link">Log In</Link>
              <Link to="/signup" className="tv-pill">Sign Up</Link>
            </>
          )}

          {user && (
            <div className="tv-menu">
              <button
                className="tv-avatar-btn"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Account menu"
              >
                <span className="tv-avatar">
                  {user.profile?.avatarUrl ? (
                    <img src={"http://localhost:3000" + user.profile.avatarUrl} alt="Your avatar" />
                  ) : (
                    user.username[0].toUpperCase()
                  )}
                </span>
              </button>

              {menuOpen && (
                <div className="tv-dropdown" onClick={() => setMenuOpen(false)}>
                  <Link to="/profile">My Profile</Link>
                  <Link to="/edit-profile">Edit Profile</Link>
                  <Link to="/school">School Verification</Link>
                  <Link to="/settings">Settings</Link>
                  <button onClick={handleLogout}>Log Out</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;