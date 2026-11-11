

import "./Navbar.css";

function Navbar() {
  return (
    <nav className="navbar">
      <h2 className="logo">TALAVYN</h2>

      <ul className="nav-links">
        <li><a href="#home">Home</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#contact">Contact</a></li>
        <li><a href="#services">Services</a></li>
      </ul>

      <div className="nav-buttons">
        <a href="#register" className="register-btn">Register</a>
        <a href="#login" className="login-btn">Login</a>
        
      </div>
    </nav>
  );
}

export default Navbar;
