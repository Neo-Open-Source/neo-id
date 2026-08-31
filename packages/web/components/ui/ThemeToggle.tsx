"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

interface ThemeToggleProps {
  className?: string;
  iconSize?: number;
  showTooltip?: boolean;
}

export function ThemeToggle({ className, iconSize = 20, showTooltip = true }: ThemeToggleProps) {
  // Always start with false (light/moon) so SSR and first client render agree.
  // useEffect runs after hydration and syncs the real value from localStorage.
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("neo_id_theme");
    const isDark =
      saved === "dark" ||
      (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(isDark);
    setMounted(true);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

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
      {/* After mount show the real icon, before mount always show moon to match SSR */}
      <Icon name={mounted && dark ? "sun" : "moon"} size={iconSize} />
      {showTooltip && mounted && (
        <span className="absolute left-14 text-xs py-1.5 px-2.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-surface-row text-content rounded-badge shadow-dropdown z-50">
          {dark ? "Light mode" : "Dark mode"}
        </span>
      )}
    </button>
  );
}
