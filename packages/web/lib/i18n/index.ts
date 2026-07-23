import en from "./en";
import uk from "./uk";
import ro from "./ro";
import ru from "./ru";
import type { Translations } from "./types";

export type { Translations } from "./types";

export const locales = ["en", "uk", "ro", "ru"] as const;
export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  en: "English",
  uk: "\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430",
  ro: "Rom\u00e2n\u0103",
  ru: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439",
};

const dictionaries: Record<Locale, Translations> = { en, uk, ro, ru };

export function getTranslations(locale: Locale): Translations {
  return dictionaries[locale] ?? dictionaries.en;
}

export function detectLocale(): Locale {
  if (typeof window === "undefined") {
    if (typeof globalThis !== "undefined") {
      const cookie = (globalThis as any).__localeCookie as string | undefined;
      if (cookie && locales.includes(cookie as Locale)) return cookie as Locale;
    }
    return "en";
  }

  // Check global set by anti-flicker script first
  const w = window as any;
  if (w.__initialLocale && locales.includes(w.__initialLocale)) return w.__initialLocale;

  const saved = localStorage.getItem("neo_id_locale") as Locale | null;
  if (saved && locales.includes(saved)) return saved;

  const nav = navigator.language.toLowerCase();
  if (nav.startsWith("uk")) return "uk";
  if (nav.startsWith("ro")) return "ro";
  if (nav.startsWith("ru")) return "ru";

  return "en";
}

export function setLocale(locale: Locale): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("neo_id_locale", locale);
    document.cookie = `neo_id_locale=${locale};path=/;max-age=31536000;SameSite=Lax`;
  }
}
