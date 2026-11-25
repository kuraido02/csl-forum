import "./Profile.css";
import { useState } from "react";
import { Link } from "react-router-dom";

function Profile({ user }) {
  const [tab, setTab] = useState("posts");

  // The contract puts display name, bio, avatar and course inside user.profile.
  const profile = user.profile || {};
  const name = profile.displayName || user.username;
  const joined = new Date(user.createdAt).toLocaleDateString();

  return (
    <main className="profile-page">
      <div className="profile-card">
        <div className="profile-top">
          <div className="avatar big">
            {profile.avatarUrl ? (
              <img src={"http://localhost:3000" + profile.avatarUrl} alt="" />
            ) : (
              name[0].toUpperCase()
            )}
          </div>

          <div className="profile-info">
            <h1>{name}</h1>
            <small>u/{user.username}</small>
            <p>
              <span className="badge">{user.role === "teacher" ? "Teacher" : "Student"}</span>
              <span className={user.schoolVerified ? "badge ok" : "badge warn"}>
                {user.schoolVerified ? "Verified" : "Not verified"}
              </span>
            </p>
          </div>

          <Link to="/edit-profile" className="btn outline">Edit profile</Link>
        </div>

        <p>{profile.bio || "No bio yet."}</p>
        <small>
          {profile.course && profile.course.name + " • "}
          {profile.yearLevel && "Year " + profile.yearLevel + " • "}
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