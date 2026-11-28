import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { getCurrentUser, isAdmin } from "./auth";
import Navbar from "./Navbar";
import Home from "./Home";
import Login from "./Login";
import Signup from "./Signup";
import ForgotPassword from "./ForgotPassword";
import VerifyEmail from "./VerifyEmail";
import ResetPassword from "./ResetPassword";
import Profile from "./Profile";
import EditProfile from "./EditProfile";
import SchoolVerification from "./SchoolVerification";
import Settings from "./Settings";
import AdminVerifications from "./AdminVerifications";

function App() {
  // "user" is the logged-in user, or null if nobody is logged in.
  // We pass it down to the pages as props.
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Runs once when the app opens: ask the server who is logged in.
  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // Don't draw the routes yet, or a logged-in person would be sent to /login.
  if (loading) return <p>Loading...</p>;

  return (
    <>
      <Navbar user={user} setUser={setUser} />
      <Routes>
        <Route path="/" element={<Home user={user} />} />

        {/* Pages for people who are NOT logged in */}
        <Route path="/login" element={user ? <Navigate to="/profile" /> : <Login setUser={setUser} />} />
        <Route path="/signup" element={user ? <Navigate to="/profile" /> : <Signup setUser={setUser} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Pages only for logged-in people. If not logged in, go to /login */}
        <Route path="/profile" element={user ? <Profile user={user} /> : <Navigate to="/login" />} />
        <Route path="/edit-profile" element={user ? <EditProfile user={user} setUser={setUser} /> : <Navigate to="/login" />} />
        <Route path="/school" element={user ? <SchoolVerification user={user} setUser={setUser} /> : <Navigate to="/login" />} />
        <Route path="/settings" element={user ? <Settings user={user} setUser={setUser} /> : <Navigate to="/login" />} />

        <Route path="/admin/verifications" element={user && isAdmin(user) ? <AdminVerifications /> : <Navigate to="/" />} />
      </Routes>
    </>
  );
}

export default App;