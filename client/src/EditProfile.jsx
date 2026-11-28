import "./Profile.css";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCourses, updateProfile, uploadAvatar, removeAvatar } from "./auth";

// The school year starts around June. Offer the current one and 3 earlier ones.
const startYear =
  new Date().getMonth() >= 5 ? new Date().getFullYear() : new Date().getFullYear() - 1;

// Shows a red message under an input, only if there is one.
function FieldError({ message }) {
  return message ? <p className="field-error">{message}</p> : null;
}

function EditProfile({ user, setUser }) {
  const p = user.profile;
  const isStudent = user.role === "student";
  const navigate = useNavigate();

  // Include the saved school year even if it is older than the list.
  const schoolYears = [0, -1, -2, -3].map((n) => `${startYear + n}-${startYear + n + 1}`);
  if (p.schoolYear && !schoolYears.includes(p.schoolYear)) schoolYears.push(p.schoolYear);

  // One object holds every text input, starting from the saved profile.
  const [form, setForm] = useState({
    displayName: p.displayName,
    bio: p.bio || "",
    courseId: p.course ? String(p.course.id) : "",
    schoolYear: p.schoolYear || schoolYears[0],
    yearLevel: String(p.yearLevel || 1),
  });
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  // Runs once when the page opens: load the courses for the dropdown.
  useEffect(() => {
    getCourses().then(setCourses).catch((err) => setError(err.message));
  }, []);

  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  // Puts a new avatarUrl (or null) into the logged-in user, so the whole app updates.
  function setAvatarUrl(avatarUrl) {
    setUser({ ...user, profile: { ...user.profile, avatarUrl } });
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    e.target.value = ""; // lets the same file be chosen again later
    if (!file) return;

    // The same rules as the contract: jpeg/png/webp, up to 2 MB.
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError("Use a JPG, PNG or WebP photo.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Photo must be under 2 MB.");
      return;
    }

    setAvatarError("");
    setAvatarBusy(true);
    try {
      setAvatarUrl(await uploadAvatar(file));
    } catch (err) {
      setAvatarError(err.fields?.avatar || err.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleRemove() {
    setAvatarError("");
    setAvatarBusy(true);
    try {
      await removeAvatar();
      setAvatarUrl(null);
    } catch (err) {
      setAvatarError(err.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const name = form.displayName.trim();
    if (!name || name.length > 50) {
      setFieldErrors({ displayName: "Enter your name (up to 50 characters)." });
      return;
    }

    // Send only the fields that changed (the contract allows this).
    const changes = {};
    if (name !== p.displayName) changes.displayName = name;
    if (form.bio.trim() !== (p.bio || "")) changes.bio = form.bio.trim(); // "" clears the bio
    if (form.courseId && Number(form.courseId) !== p.course?.id) {
      changes.courseId = Number(form.courseId);
    }
    if (isStudent) {
      if (form.schoolYear !== p.schoolYear) changes.schoolYear = form.schoolYear;
      if (Number(form.yearLevel) !== p.yearLevel) changes.yearLevel = Number(form.yearLevel);
    }

    // Nothing changed: the server would answer "Nothing to update.", so just go back.
    if (Object.keys(changes).length === 0) {
      navigate("/profile");
      return;
    }

    setSaving(true);
    try {
      setUser(await updateProfile(changes));
      navigate("/profile");
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fields || {});
    } finally {
      setSaving(false);
    }
  }

  const initial = (form.displayName.trim()[0] || user.username[0]).toUpperCase();

  return (
    <main className="profile-page">
      <form className="profile-card" onSubmit={handleSubmit}>
        <h1>Edit Profile</h1>

        <div className="row">
          <div className="avatar big">
            {p.avatarUrl ? (
              <img src={"http://localhost:3000" + p.avatarUrl} alt="Your avatar" />
            ) : (
              initial
            )}
          </div>
          <div className="avatar-actions">
            {/* The label acts as the button; the real file input is hidden */}
            <label className="btn outline">
              {avatarBusy ? "Working..." : "Choose photo"}
              <input type="file" accept="image/jpeg,image/png,image/webp"
                onChange={handleFile} disabled={avatarBusy} hidden />
            </label>
            {p.avatarUrl && (
              <button type="button" className="btn outline"
                onClick={handleRemove} disabled={avatarBusy}>
                Remove photo
              </button>
            )}
          </div>
        </div>
        <p className="hint">Photo changes save right away. JPG, PNG or WebP, up to 2 MB.</p>
        <FieldError message={avatarError} />

        <input name="displayName" placeholder="Display name" value={form.displayName}
          maxLength={50} onChange={update} required />
        <FieldError message={fieldErrors.displayName} />

        <textarea name="bio" placeholder="Bio" rows={3} maxLength={500}
          value={form.bio} onChange={update} />
        <FieldError message={fieldErrors.bio} />

        <label htmlFor="courseId">Course</label>
        <select id="courseId" name="courseId" value={form.courseId} onChange={update}>
          <option value="">{p.course ? "Select your course" : "Select your course (needed to post)"}</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
          ))}
        </select>
        <p className="hint">Posts you submit after changing course go to your new department's moderators.</p>
        <FieldError message={fieldErrors.courseId} />

        {isStudent && (
          <div className="row">
            <div className="grow">
              <label htmlFor="schoolYear">School year</label>
              <select id="schoolYear" name="schoolYear" value={form.schoolYear} onChange={update}>
                {schoolYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="grow">
              <label htmlFor="yearLevel">Year level</label>
              <select id="yearLevel" name="yearLevel" value={form.yearLevel} onChange={update}>
                <option value="1">1st year</option>
                <option value="2">2nd year</option>
                <option value="3">3rd year</option>
                <option value="4">4th year</option>
              </select>
            </div>
          </div>
        )}
        <FieldError message={fieldErrors.schoolYear} />
        <FieldError message={fieldErrors.yearLevel} />

        {error && <p className="error">{error}</p>}

        <div className="row">
          <button className="btn" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
          <Link to="/profile" className="btn outline">Cancel</Link>
        </div>
      </form>
    </main>
  );
}

export default EditProfile;