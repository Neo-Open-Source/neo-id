"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { PasswordChangeForm } from "@/components/features/profile/PasswordChangeForm";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";

export default function PasswordPage() {
  const { t } = useI18n();
  usePageTitle(t.pages.changePassword);

  return (
    <div className="profile-page password-page">
      <Link href="/profile" className="page-back">
        <Icon name="arrow-left" size={16} />
        {t.profile.backToProfile}
      </Link>

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
