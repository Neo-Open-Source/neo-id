"use client";

import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n/context";
import { localeNames, type Locale } from "@/lib/i18n";

const FLAGS: Record<Locale, string> = {
  en: "/flags/gb.webp",
  uk: "/flags/ua.webp",
  ro: "/flags/ro.webp",
  ru: "/flags/ru.webp",
};

export function LanguagePicker() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="language-picker__trigger"
        aria-label={localeNames[locale]}
      >
        <img src={FLAGS[locale]} alt="" className="language-flag language-flag--sm" />
        <span>{localeNames[locale]}</span>
      </button>

      {open && (
        <div className="language-picker__menu">
          {(Object.keys(localeNames) as Locale[]).map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => {
                setLocale(loc);
                setOpen(false);
              }}
              className={`language-picker__option${loc === locale ? " language-picker__option--active" : ""}`}
            >
              <img src={FLAGS[loc]} alt="" className="language-flag language-flag--sm" />
              <span>{localeNames[loc]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
