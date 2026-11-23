import "./Profile.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { updateUser } from "./auth";

function EditProfile({ user, setUser }) {

  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || "");
  const [school, setSchool] = useState(user.school || "");
  const [avatar, setAvatar] = useState(user.avatar || "");
  const [error, setError] = useState("");
  const navigate = useNavigate();


  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 400 * 1024) {
        setError("Photo must be under 4 MB.");
        return;
    }

    setError("");
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result);
    }
    
function handleSubmit(e) {
    e.preventDefault();
    const updated = updateUser(user.id, { name, bio, school, avatar });
    setUser(updated);
    navigate("/profile");
}

return (
    <main className="profile-page">
        <form className="profile-card" onSubmit={handleSubmit}>
            <h1>Edit Profile</h1>
            
            <div className="row">
                <div className="avatar big">
                    {avatar ? <img src={avatar} alt="" /> : name[0].toUpperCase()}
                </div>
                <input type="file" accept="image/*" onChange={handleFile} style={{ width: "auto" }} />
                <button type="button" className="btn outline" onClick={() => setAvatar("")}>Remove photo</button>
            </div>

            <input placeholder="Display name" value={name}
                onChange={(e) => setName(e.target.value)} required />
            <textarea placeholder="Bio" rows={3} maxLength={200} value={bio}
                onChange={(e) => setBio(e.target.value)} />
            <input placeholder="School" value={school}
                onChange={(e) => setSchool(e.target.value)} />

            {error && <p className="error">{error}</p>}

            <div className="row">
                <button className="btn">Save changes</button>
                <Link to="/profile" className="btn outline">Cancel</Link>
            </div>
          </form>
        </main>
);
}

export default EditProfile;