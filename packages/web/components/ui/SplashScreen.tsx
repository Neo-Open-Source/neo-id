"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { NeoLogo } from "@/components/ui/NeoLogo";
import { prefetchAppBounded } from "@/lib/prefetch-app";

interface SplashScreenProps {
  variant?: "fullscreen" | "overlay" | "inline";
  logoSize?: number;
  label?: string;
  prefetch?: boolean;
  onReady?: () => void;
  className?: string;
}

export function SplashScreen({
  variant = "fullscreen",
  logoSize = 40,
  label,
  prefetch = false,
  onReady,
  className,
}: SplashScreenProps) {
  useEffect(() => {
    if (!prefetch) return;
    let cancelled = false;
    void prefetchAppBounded().then(() => {
      if (!cancelled) onReady?.();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefetch]);

  return (
    <div
      className={cn(
        "splash",
        variant === "fullscreen" && "splash--fullscreen",
        variant === "overlay" && "splash--overlay",
        className,
      )}
      role="status"
      aria-label={label ?? "Loading Neo ID"}
    >
      <div className="splash__logo">
        <NeoLogo size={logoSize} priority />
      </div>
      {label && <p className="splash__label">{label}</p>}
    </div>
  );
}
