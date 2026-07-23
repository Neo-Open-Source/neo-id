"use client";

import { BackButton } from "@/components/ui/BackButton";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n/context";
import { toast } from "sonner";
import { usePageTitle } from "@/lib/use-page-title";
import { localeNames, type Locale, getTranslations } from "@/lib/i18n";

const LANGUAGES: { code: Locale; flag: string }[] = [
  { code: "en", flag: "/flags/gb.webp" },
  { code: "uk", flag: "/flags/ua.webp" },
  { code: "ro", flag: "/flags/ro.webp" },
  { code: "ru", flag: "/flags/ru.webp" },
];

export default function LanguagePage() {
  const { locale, setLocale, t } = useI18n();
  usePageTitle(t.pages.language);

  return (
    <div className="page profile-page">
      <BackButton href="/profile" label={t.profile.backToProfile} />

      <div className="page-intro">
        <h1 className="page-intro__title">{t.language?.title ?? t.profile.language}</h1>
        <p className="page-intro__desc">{t.language?.subtitle ?? ""}</p>
      </div>

      <div className="profile-group">
        {LANGUAGES.map((lang) => {
          const active = locale === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              className={`settings-row${active ? " language-row--active" : ""}`}
              onClick={() => {
                if (lang.code === locale) return;
                setLocale(lang.code);
                const next = getTranslations(lang.code);
                toast.success(next.language?.updated ?? next.common.success);
              }}
            >
              <img src={lang.flag} alt="" className="language-flag" />
              <span className="settings-row__label">{localeNames[lang.code]}</span>
              {active && <Icon name="check" size={16} className="text-accent" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
