"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

interface ThemeToggleProps {
  className?: string;
  iconSize?: number;
  showTooltip?: boolean;
}

export function ThemeToggle({ className, iconSize = 20, showTooltip = true }: ThemeToggleProps) {
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
      className={cn(
        "group relative flex items-center justify-center rounded-button text-muted cursor-pointer transition-all outline-none hover:text-content hover:bg-surface-hover",
        showTooltip ? "w-12 h-12" : "w-8 h-8",
        className,
      )}
    >
      {dark ? <Sun size={iconSize} /> : <Moon size={iconSize} />}
      {showTooltip && (
        <span className="absolute left-14 text-xs py-1.5 px-2.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-surface-row text-content rounded-badge shadow-dropdown z-50">
          {dark ? "Light mode" : "Dark mode"}
        </span>
      )}
    </button>
  );
}
