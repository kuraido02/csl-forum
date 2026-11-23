import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { getCurrentUser } from "./auth";
import Navbar from "./Navbar";
import Home from "./Home";
import Login from "./Login";
import Signup from "./Signup";
import ForgotPassword from "./ForgotPassword";
import Verify from "./Verify";
import Profile from "./Profile";
import EditProfile from "./EditProfile";
import SchoolVerification from "./SchoolVerification";
import Settings from "./Settings";

function App() {
  // "user" is the logged-in user, or null if nobody is logged in.
  // We pass it down to the pages as props.
  const [user, setUser] = useState(getCurrentUser());

  return (
    <>
      <Navbar user={user} setUser={setUser} />
      <Routes>
        <Route path="/" element={<Home />} />

        {/* Pages for people who are NOT logged in */}
        <Route path="/login" element={user ? <Navigate to="/profile" /> : <Login setUser={setUser} />} />
        <Route path="/signup" element={user ? <Navigate to="/profile" /> : <Signup setUser={setUser} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Pages only for logged-in people. If not logged in, go to /login */}
        <Route path="/verify" element={user ? <Verify user={user} setUser={setUser} /> : <Navigate to="/login" />} />
        <Route path="/profile" element={user ? <Profile user={user} /> : <Navigate to="/login" />} />
        <Route path="/edit-profile" element={user ? <EditProfile user={user} setUser={setUser} /> : <Navigate to="/login" />} />
        <Route path="/school" element={user ? <SchoolVerification user={user} setUser={setUser} /> : <Navigate to="/login" />} />
        <Route path="/settings" element={user ? <Settings user={user} setUser={setUser} /> : <Navigate to="/login" />} />
      </Routes>
    </>
  );
}

export default App;