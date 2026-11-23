import "./Profile.css";
import { useState } from "react";
import { Link } from "react-router-dom";

function Profile({ user }) {
  const [tab, setTab] = useState("posts");

  const isVerified = user.schoolVerified || user.teacherStatus === "approved";
  const joined = new Date(user.created).toLocaleDateString();

  return (
    <main className="profile-page">
      <div className="profile-card">
        <div className="profile-top">
         
          <div className="avatar big">
            {user.avatar ? <img src={user.avatar} alt="" /> : user.name[0].toUpperCase()}
          </div>

          <div className="profile-info">
            <h1>{user.name}</h1>
            <small>u/{user.username}</small>
            <p>
              <span className="badge">{user.role === "teacher" ? "Teacher" : "Student"}</span>
              <span className={isVerified ? "badge ok" : "badge warn"}>
                {isVerified ? "Verified" : "Not verified"}
              </span>
              {!user.emailVerified && <Link to="/verify" className="badge warn">Verify email</Link>}
            </p>
          </div>

          <Link to="/edit-profile" className="btn outline">Edit profile</Link>
        </div>

        <p>{user.bio || "No bio yet."}</p>
        <small>
          {user.school && user.school + " • "}
          Joined {joined}
        </small>
      </div>

      <div className="profile-card">
        <div className="tabs">
          <button className={tab === "posts" ? "active" : ""} onClick={() => setTab("posts")}>Posts</button>
          <button className={tab === "comments" ? "active" : ""} onClick={() => setTab("comments")}>Comments</button>
        </div>
        <p className="empty">No {tab} yet.</p>
      </div>
    </main>
  );
}

export default Profile;