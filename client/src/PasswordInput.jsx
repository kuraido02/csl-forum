import "./PasswordInput.css";
import { useState } from "react";

// A password input with a Show/Hide button.
// It takes the same props as a normal <input> (name, placeholder, value, onChange...).
function PasswordInput({ name, placeholder, value, onChange, required, autoComplete }) {
  const [show, setShow] = useState(false);

  return (
    <div className="pw-field">
      <input
        type={show ? "text" : "password"}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setShow(!show)}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}

export default PasswordInput;