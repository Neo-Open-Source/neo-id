"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AvatarUpload } from "@/components/ui/AvatarUpload";
import { SettingsRow } from "@/components/ui/SettingsRow";
import { PasswordChangeForm } from "@/components/features/profile/PasswordChangeForm";
import { LoginMethodRows } from "@/components/features/profile/LoginMethodsSection";
import { UsernameChangeModal } from "@/components/features/profile/UsernameChangeModal";
import { EmailChangeModal } from "@/components/features/profile/EmailChangeModal";
import { NameChangeModal } from "@/components/features/profile/NameChangeModal";
import { DeleteAccountModal } from "@/components/features/profile/DeleteAccountModal";
import { ProfileSkeleton } from "@/components/ui/Skeleton";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";
import { localeNames } from "@/lib/i18n";
import { apiUpload, ApiError, logoutSession } from "@/lib/api";

interface Profile {
  id: string; email: string; username?: string; displayName?: string;
  firstName?: string; lastName?: string; avatar?: string; role: string;
  hasPassword: boolean; totpEnabled: boolean; emailMfaEnabled: boolean;
  passkeyCount: number; connectionCount: number; createdAt: string;
  identities: Array<{ id: string; provider: string; createdAt: string }>;
}

export default function ProfilePage() {
  const { t, locale } = useI18n();
  usePageTitle(t.pages.profile);
  const router = useRouter();
  const { data: profile, error: loadError, mutate, refresh } = useCachedQuery<Profile>("/user/profile");

  const [loggingOut, setLoggingOut] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [exportRedirecting, setExportRedirecting] = useState(false);

  const [modal, setModal] = useState<"name" | "username" | "email" | "password" | "delete" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linked = params.get("oauth_linked");
    if (!linked) return;
    refresh();
    params.delete("oauth_linked");
    const next = params.toString();
    window.history.replaceState({}, "", next ? `?${next}` : window.location.pathname);
  }, [refresh]);

  const handleAvatarUpload = useCallback(async (file: File) => {
    setAvatarError(null);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const data = await apiUpload<{ avatar: string }>("/user/avatar", formData);
      mutate((prev) => (prev ? { ...prev, avatar: data.avatar } : prev));
    } catch (e) {
      setAvatarError(e instanceof ApiError ? e.message : t.common.uploadFailed);
    }
  }, [mutate, t.common.uploadFailed]);

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await logoutSession(); } finally { router.replace("/auth"); }
  }, [loggingOut, router]);

  const handleExportAction = useCallback(() => {
    if (exportRedirecting) return;
    setExportRedirecting(true);
    router.push(`/auth/2fa/mfa?purpose=export&email=${encodeURIComponent(profile?.email || "")}&mode=login`);
  }, [exportRedirecting, profile, router]);

  if (!profile) {
    if (loadError) {
      return (
        <div className="page profile-page">
          <div className="alert alert--error">{loadError}</div>
          <Button onClick={() => refresh()}>{t.common.refresh}</Button>
        </div>
      );
    }
    return <ProfileSkeleton />;
  }

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  const shownName = profile.displayName || fullName || profile.email || "";
  const nameValue = fullName || profile.displayName || t.common.notSet;
  const securityStatus = profile.totpEnabled || profile.emailMfaEnabled;

  return (
    <div className="page profile-page">
      <section className="profile-identity">
        <AvatarUpload
          src={profile.avatar} name={shownName} size="lg" menuStyle
          onUpload={handleAvatarUpload}
          onSaved={(avatar) => mutate((prev) => (prev ? { ...prev, avatar } : prev))}
        />
        <h1 className="profile-identity__name">{shownName}</h1>
        <p className="profile-identity__email">{profile.email}</p>
        {avatarError && <p className="profile-identity__error">{avatarError}</p>}
      </section>

      <div className="profile-group">
        <SettingsRow icon="user" label={t.profile.fullName} value={nameValue} onClick={() => setModal("name")} />
        <SettingsRow icon="envelope" label={t.profile.emailAddress} value={profile.email} onClick={() => setModal("email")} />
        <SettingsRow icon="at" label={t.profile.username} value={profile.username || t.common.notSet} onClick={() => setModal("username")} />
      </div>

      <div className="profile-group">
        <SettingsRow icon="apps" label={t.profile.appsAndAgents} value={profile.connectionCount > 0 ? String(profile.connectionCount) : undefined} href="/connected" />
        <SettingsRow icon="fingerprint" label={t.profile.passkeys} value={profile.passkeyCount > 0 ? String(profile.passkeyCount) : undefined} href="/profile/passkeys" />
        <SettingsRow icon="shield" label={t.profile.twoFactor} value={securityStatus ? t.common.enabled : t.common.notEnabled} href="/profile/mfa" />
        <SettingsRow icon="lock" label={t.profile.password} value={profile.hasPassword ? "••••••••" : t.common.notSet} onClick={() => setModal("password")} />
        <LoginMethodRows identities={profile.identities ?? []} onChanged={refresh} />
      </div>

      <div className="profile-group">
        <SettingsRow icon="globe" label={t.profile.language} value={localeNames[locale]} href="/profile/language" className="md:hidden" />
      </div>

      <div className="profile-group">
        <SettingsRow icon="document-signed" label={t.profile.terms} href="/terms" />
        <SettingsRow icon="lock" label={t.profile.privacy} href="/privacy" />
      </div>

      <div className="profile-actions">
        <button type="button" className="profile-logout-btn" onClick={handleLogout} disabled={loggingOut}>{t.nav.logout}</button>
        <button type="button" className="profile-delete-link" onClick={handleExportAction}>{t.profile.exportData}</button>
        <button type="button" className="profile-delete-link" onClick={() => setModal("delete")}>{t.profile.deleteAccount}</button>
      </div>

      <NameChangeModal
        open={modal === "name"}
        initial={{ displayName: profile.displayName, firstName: profile.firstName, lastName: profile.lastName }}
        onClose={() => setModal(null)}
        onSaved={(data) => mutate((prev) => (prev ? { ...prev, ...data } : prev))}
      />

      <UsernameChangeModal
        open={modal === "username"}
        currentUsername={profile.username}
        onClose={() => setModal(null)}
        onSaved={(nextUsername) => mutate((prev) => (prev ? { ...prev, username: nextUsername } : prev))}
      />

      <EmailChangeModal
        open={modal === "email"}
        onClose={() => setModal(null)}
        currentEmail={profile.email}
      />

      <Modal
        open={modal === "password"}
        onClose={() => setModal(null)}
        title={t.profile.changePassword}
        description={profile.hasPassword ? t.profile.updateYourPassword : t.profile.setPasswordForAccount}
        size="sm"
      >
        <PasswordChangeForm
          compact
          onCancel={() => setModal(null)}
          onSuccess={() => { refresh(); setModal(null); }}
        />
      </Modal>

      <DeleteAccountModal
        open={modal === "delete"}
        hasPassword={profile.hasPassword}
        onClose={() => setModal(null)}
      />
    </div>
  );
}
