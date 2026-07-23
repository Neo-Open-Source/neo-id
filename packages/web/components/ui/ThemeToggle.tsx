"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("neo_id_theme");
    return saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("neo_id_theme", next ? "dark" : "light");
  };

  return (
    <button
      onClick={toggle}
      className="group relative flex items-center justify-center w-12 h-12 rounded-button text-muted cursor-pointer transition-all outline-none hover:text-content hover:bg-surface-hover"
    >
      {dark ? <Sun size={20} /> : <Moon size={20} />}
      <span className="absolute left-14 text-xs py-1.5 px-2.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-surface-row text-content rounded-badge shadow-dropdown z-50">
        {dark ? "Light mode" : "Dark mode"}
      </span>
    </button>
  );
}
