"use client";

import { BackButton } from "@/components/ui/BackButton";
import { PasswordChangeForm } from "@/components/features/profile/PasswordChangeForm";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";

export default function PasswordPage() {
  const { t } = useI18n();
  usePageTitle(t.pages.changePassword);

  return (
    <div className="profile-page password-page">
      <BackButton href="/profile" label={t.profile.backToProfile} />

      <section className="profile-group password-page__card">
        <div className="password-page__header">
          <h1>{t.profile.changePassword}</h1>
          <p>{t.profile.updateYourPassword}</p>
        </div>
        <div className="password-page__body">
          <PasswordChangeForm />
        </div>
      </section>
    </div>
  );
}
