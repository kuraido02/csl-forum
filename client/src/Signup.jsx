import "./Signup.css";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { signup, getCourses } from "./auth";

// The school year starts around June. Offer the current one and 3 earlier ones.
const startYear =
  new Date().getMonth() >= 5 ? new Date().getFullYear() : new Date().getFullYear() - 1;
const schoolYears = [0, -1, -2, -3].map(
  (n) => `${startYear + n}-${startYear + n + 1}`
);

// Shows a red message under an input, only if there is one.
function FieldError({ message }) {
  return message ? <p className="field-error">{message}</p> : null;
}

function Signup() {
  // One object holds every input, instead of ten separate useState lines.
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    email: "",
    password: "",
    confirm: "",
    role: "student",
    courseId: "",
    schoolYear: schoolYears[0],
    yearLevel: "1",
  });
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");          // one message for the whole form
  const [fieldErrors, setFieldErrors] = useState({}); // messages under single inputs
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Runs once when the page opens: load the courses for the dropdown.
  useEffect(() => {
    getCourses()
      .then(setCourses)
      .catch((err) => setError(err.message));
  }, []);

  // Every input has a name="..." that matches a key in `form`.
  // [e.target.name] means "use the input's name as the key".
  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  // The same rules as the contract. The server checks them again anyway.
  function validate() {
    const p = {};
    const name = form.displayName.trim();
    if (!name || name.length > 50) p.displayName = "Enter your full name (up to 50 characters).";
    if (!/^[A-Za-z0-9_]{3,30}$/.test(form.username))
      p.username = "3 to 30 characters: letters, numbers and underscore only.";
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password))
      p.password = "At least 8 characters, with a letter and a number.";
    if (form.password !== form.confirm) p.confirm = "Passwords do not match.";
    if (!form.courseId) p.courseId = "Choose your course.";
    return p;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const problems = validate();
    if (Object.keys(problems).length > 0) {
      setFieldErrors(problems);
      return;
    }

    // Build the object the contract asks for.
    const fields = {
      username: form.username.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      displayName: form.displayName.trim(),
      role: form.role,
      courseId: Number(form.courseId),
    };
    // Only students send school year and year level.
    if (form.role === "student") {
      fields.schoolYear = form.schoolYear;
      fields.yearLevel = Number(form.yearLevel);
    }

    setSubmitting(true);
    try {
      await signup(fields);
      setDone(true); // NOT logged in yet: the user must verify the email first
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fields || {}); // e.g. { email: "Email is already used." }
    } finally {
      setSubmitting(false);
    }
  }

  // After a successful sign-up, show this instead of the form.
  if (done) {
    return (
      <div className="signup">
        <h1>Salamat!</h1>
        <p>
          We sent a link to <strong>{form.email}</strong>. Check your email and
          click it to verify your account, then log in.
        </p>
        <Link to="/login" className="btn">Go to Log In</Link>
      </div>
    );
  }

  return (
    <form className="signup" onSubmit={handleSubmit}>
      <h1>Sign Up</h1>

      <input name="displayName" placeholder="Full Name" value={form.displayName}
        onChange={update} required />
      <FieldError message={fieldErrors.displayName} />

      <input name="username" placeholder="Username" value={form.username}
        onChange={update} required />
      <FieldError message={fieldErrors.username} />

      <input name="email" type="email" placeholder="Email" value={form.email}
        onChange={update} required />
      <FieldError message={fieldErrors.email} />

      <input name="password" type="password" placeholder="Password" value={form.password}
        onChange={update} required />
      <FieldError message={fieldErrors.password} />

      <input name="confirm" type="password" placeholder="Confirm Password" value={form.confirm}
        onChange={update} required />
      <FieldError message={fieldErrors.confirm} />

      <label htmlFor="role">I am a</label>
      <select id="role" name="role" value={form.role} onChange={update}>
        <option value="student">Student</option>
        <option value="teacher">Teacher</option>
      </select>

      <label htmlFor="courseId">Course</label>
      <select id="courseId" name="courseId" value={form.courseId} onChange={update} required>
        <option value="">Select your course</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
        ))}
      </select>
      {form.role === "teacher" && (
        <p className="hint">Choose the course of your department.</p>
      )}
      <FieldError message={fieldErrors.courseId} />

      {form.role === "student" && (
        <>
          <div className="row">
            <div>
              <label htmlFor="schoolYear">School year</label>
              <select id="schoolYear" name="schoolYear" value={form.schoolYear} onChange={update}>
                {schoolYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="yearLevel">Year level</label>
              <select id="yearLevel" name="yearLevel" value={form.yearLevel} onChange={update}>
                <option value="1">1st year</option>
                <option value="2">2nd year</option>
                <option value="3">3rd year</option>
                <option value="4">4th year</option>
              </select>
            </div>
          </div>
          <FieldError message={fieldErrors.schoolYear} />
          <FieldError message={fieldErrors.yearLevel} />
        </>
      )}

      {error && <p className="error">{error}</p>}

      <button className="btn" disabled={submitting}>
        {submitting ? "Creating account..." : "Sign Up"}
      </button>
      <p>Already a member? <Link to="/login">Log In</Link></p>
    </form>
  );
}

export default Signup;