import { useState, useEffect, useCallback } from "react";

function readInitialDark(): boolean {
  if (typeof window === "undefined") return false;
  const saved = localStorage.getItem("admin-theme");
  if (saved) return saved === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(readInitialDark);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("admin-theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("admin-theme", "light");
    }
  }, [isDark]);

  const toggle = useCallback(() => setIsDark(prev => !prev), []);

  return { isDark, toggle };
}
