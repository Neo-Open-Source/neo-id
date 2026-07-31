"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { localeNames, type Locale } from "@/lib/i18n";

const FLAGS: Record<Locale, string> = {
  en: "/flags/gb.webp",
  uk: "/flags/ua.webp",
  ro: "/flags/ro.webp",
  ru: "/flags/ru.webp",
};

const CODES: Record<Locale, string> = {
  en: "EN",
  uk: "UK",
  ro: "RO",
  ru: "RU",
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
    <div ref={ref} className="language-picker">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="language-picker__trigger"
        aria-label={localeNames[locale]}
        aria-expanded={open}
      >
        <Image src={FLAGS[locale]} alt="" width={18} height={18} className="language-flag language-flag--sm" />
        <span className="language-picker__code">{CODES[locale]}</span>
        <ChevronDown size={13} className={`language-picker__chevron${open ? " language-picker__chevron--open" : ""}`} />
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
              <Image src={FLAGS[loc]} alt="" width={20} height={15} className="language-flag language-flag--sm" />
              <span className="language-picker__option-code">{CODES[loc]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
