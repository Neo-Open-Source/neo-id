"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "neo_id_theme";

function readTheme(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function useTheme() {
  // Always start false so SSR and first client render agree.
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(readTheme());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle("dark", dark);
  }, [dark, mounted]);

  const setTheme = useCallback((next: boolean) => {
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // ignore
    }
  }, []);

  return { dark, mounted, setTheme };
}
