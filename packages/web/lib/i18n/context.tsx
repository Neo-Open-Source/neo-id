"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  type Locale,
  type Translations,
  detectLocale,
  setLocale as saveLocale,
  getTranslations,
  locales,
} from "./index";

interface I18nContextValue {
  locale: Locale;
  t: Translations;
  setLocale: (locale: Locale) => void;
  locales: readonly Locale[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: string }) {
  const startLocale = (initialLocale && locales.includes(initialLocale as Locale) ? initialLocale : detectLocale()) as Locale;
  const [locale, setLocaleState] = useState<Locale>(startLocale);
  const [t, setT] = useState<Translations>(() => getTranslations(startLocale));

  const handleSetLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    setT(getTranslations(newLocale));
    saveLocale(newLocale);
  };

  return (
    <I18nContext.Provider value={{ locale, t, setLocale: handleSetLocale, locales }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
