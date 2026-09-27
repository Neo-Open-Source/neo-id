"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BackButton } from "@/components/ui/BackButton";
import { LanguagePicker } from "@/components/features/auth/LanguagePicker";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/cn";

const HIDE_AFTER = 120;

export function LegalNav() {
  const { t } = useI18n();
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const y = window.scrollY;
        const dy = y - lastY.current;
        lastY.current = y;
        if (y <= HIDE_AFTER || dy < 0) {
          setHidden(false);
        } else if (dy > 0) {
          setHidden(true);
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={cn("legal-nav", hidden && "legal-nav--hidden")}>
      <BackButton
        onClick={() => {
          if (window.history.length > 1) router.back();
          else router.push("/profile");
        }}
        label={t.legal.back}
        className="legal-back"
      />
      <LanguagePicker />
    </nav>
  );
}
