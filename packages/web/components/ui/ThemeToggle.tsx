"use client";

import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/cn";

interface ThemeToggleProps {
  className?: string;
  iconSize?: number;
  showTooltip?: boolean;
}

function SunIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function ThemeToggle({ className, iconSize = 20, showTooltip = true }: ThemeToggleProps) {
  const { dark, mounted, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(!dark)}
      className={cn(
        "group relative flex items-center justify-center rounded-button text-muted cursor-pointer transition-all outline-none hover:text-content hover:bg-surface-hover",
        showTooltip ? "w-12 h-12" : "w-8 h-8",
        className,
      )}
    >
      {/* After mount show the real icon, before mount always show moon to match SSR */}
      {mounted && dark ? <SunIcon size={iconSize} /> : <MoonIcon size={iconSize} />}
      {showTooltip && mounted && (
        <span className="absolute left-14 text-xs py-1.5 px-2.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-surface-row text-content rounded-badge shadow-dropdown z-50">
          {dark ? "Light mode" : "Dark mode"}
        </span>
      )}
    </button>
  );
}
