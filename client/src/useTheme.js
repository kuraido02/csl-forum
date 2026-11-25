import { useEffect, useState } from "react";

// Decides the starting theme: the saved choice, or the device's setting
function getStartTheme() {
  const saved = localStorage.getItem("talavyn-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function useTheme() {
  const [theme, setTheme] = useState(getStartTheme);

  // Runs every time `theme` changes: updates <html> and remembers the choice
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("talavyn-theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((t) => (t === "light" ? "dark" : "light"));

  return { theme, toggleTheme };
}