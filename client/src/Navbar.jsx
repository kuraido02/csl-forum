import "./Navbar.css";
import "./Profile.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SearchBar from "./SearchBar";
import { logout } from "./auth";

function Navbar({ user, setUser }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  async function handleLogout() {
    await logout(); // tells the server to clear the cookie
    setUser(null);
    setMenuOpen(false);
    navigate("/login");
  }

  return (
    <nav className="navbar">
      <Link to="/" className="logo">CSL FORUM</Link>

      <SearchBar />

      {!user && (
        <>
          <Link to="/signup" className="btn">Sign Up</Link>
          <Link to="/login" className="btn outline">Log In</Link>
        </>
      )}

      {user && (
        <div className="menu">
          <button className="avatar-btn" onClick={() => setMenuOpen(!menuOpen)}>
            <div className="avatar">
              {user.profile?.avatarUrl ? (
                <img src={"http://localhost:3000" + user.profile.avatarUrl} alt="Avatar" />
              ) : (
                user.username[0].toUpperCase()
              )}
            </div>
          </button>
          {menuOpen && (
            <div className="dropdown" onClick={() => setMenuOpen(false)}>
              <Link to="/profile">My Profile</Link>
              <Link to="/edit-profile">Edit Profile</Link>
              <Link to="/school">School Verification</Link>
              <Link to="/settings">Settings</Link>
              <button onClick={handleLogout}>Log Out</button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

export default Navbar;