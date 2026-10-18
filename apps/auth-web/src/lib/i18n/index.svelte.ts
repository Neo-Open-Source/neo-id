import { de } from './locales/de';
import { en, type Dict, type MessageKey } from './locales/en';
import { ro } from './locales/ro';
import { ru } from './locales/ru';
import { uk } from './locales/uk';

export type { MessageKey };

export type Locale = 'en' | 'uk' | 'de' | 'ro' | 'ru';

const DICTS: Record<Locale, Dict> = { en, uk, de, ro, ru };
const STORAGE_KEY = 'neo_locale';

export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'uk', label: 'Українська' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ro', label: 'Română' },
  { code: 'ru', label: 'Русский' }
];

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && value in DICTS;
}

function detect(): Locale {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isLocale(stored)) return stored;
  for (const lang of navigator.languages ?? []) {
    const base = lang.split('-')[0]?.toLowerCase();
    if (isLocale(base)) return base;
  }
  return 'en';
}

let current = $state<Locale>(detect());

export function locale(): Locale {
  return current;
}

export function setLocale(next: Locale) {
  current = next;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const dict = DICTS[current];
  let message = dict[key] ?? en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      message = message.replaceAll(`{${name}}`, String(value));
    }
  }
  return message;
}
