"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { CodeInput } from "@/components/ui/CodeInput";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ListPageSkeleton } from "@/components/ui/Skeleton";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { useI18n } from "@/lib/i18n/context";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

interface MfaProfile {
  email?: string;
  totpEnabled: boolean;
  emailMfaEnabled: boolean;
}

import { usePageTitle } from "@/lib/use-page-title";

export default function MfaSettingsPage() {
  const { t } = useI18n();
  usePageTitle(t.pages.security);
  const router = useRouter();
  const { data: profile, isLoading, mutate } = useCachedQuery<MfaProfile>("/user/profile");
  const [totpSetup, setTotpSetup] = useState<{ qr_code_url?: string; secret?: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const handleSetupTotp = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const data = await api<{ qr_code_url?: string; secret?: string }>("/mfa/totp/setup", {
        method: "POST",
      });
      setTotpSetup(data);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnableTotp = async () => {
    if (actionLoading || totpCode.length !== 6) return;
    setActionLoading(true);
    try {
      await api("/mfa/totp/enable", { method: "POST", body: { code: totpCode } });
      mutate((current) => (current ? { ...current, totpEnabled: true } : current));
      setTotpSetup(null);
      setTotpCode("");
      toast.success(t.common.success);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisableTotp = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await api("/mfa/totp/disable", { method: "POST" });
      mutate((current) => (current ? { ...current, totpEnabled: false } : current));
      toast.success(t.common.success);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetupEmailMfa = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const data = await api<{ email_hint?: string }>("/mfa/email/setup", { method: "POST" });
      const hint = data.email_hint || profile?.email || "";
      const params = new URLSearchParams({
        mode: "setup",
        email: profile?.email || "",
        emailHint: hint,
      });
      router.push(`/auth/2fa/mfa?${params.toString()}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
      setActionLoading(false);
    }
  };

  const handleDisableEmailMfa = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await api("/mfa/email/disable", { method: "POST" });
      mutate((current) => (current ? { ...current, emailMfaEnabled: false } : current));
      toast.success(t.common.success);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setActionLoading(false);
    }
  };

  if (!profile) {
    if (isLoading) return <ListPageSkeleton rows={2} />;
    return <ListPageSkeleton rows={2} />;
  }

  return (
    <div className="page profile-page">
      <BackButton href="/profile" label={t.profile.backToProfile} />

      <div className="page-intro">
        <h1 className="page-intro__title">{t.profile.twoFactor}</h1>
        <p className="page-intro__desc">{t.profile.securitySubtitle}</p>
      </div>

      <div className="profile-group">
        <div className="list-row list-row--header">
          <div className="list-row__icon-wrap list-row__icon-wrap--accent">
            <Icon name="shield" size={18} />
          </div>
          <div className="list-row__content">
            <p className="list-row__title">{t.profile.authenticatorApp}</p>
            <p className="list-row__meta">{t.profile.authenticatorDesc}</p>
          </div>
          <StatusBadge variant={profile.totpEnabled ? "enabled" : "disabled"}>
            {profile.totpEnabled ? t.common.enabled : t.common.notEnabled}
          </StatusBadge>
        </div>

        <div className="list-row__panel">
          {totpSetup ? (
            <div className="mfa-setup">
              <div className="mfa-setup__qr">
                <Image src={totpSetup.qr_code_url!} alt="QR Code" width={180} height={180} unoptimized />
              </div>
              <div className="mfa-setup__secret">
                <p>{t.profile.enterManualKey}</p>
                <code>{totpSetup.secret}</code>
              </div>
              <CodeInput
                label={t.profile.enterCodeFromApp}
                placeholder={t.auth.mfa.codePlaceholder}
                value={totpCode}
                onChange={setTotpCode}
                autoFocus
              />
              <Button
                onClick={handleEnableTotp}
                loading={actionLoading}
                disabled={totpCode.length !== 6}
                className="w-full"
              >
                {t.profile.verifyAndEnable}
              </Button>
            </div>
          ) : profile.totpEnabled ? (
            <Button
              variant="danger"
              onClick={handleDisableTotp}
              loading={actionLoading}
            >
              {t.profile.disableAuth}
            </Button>
          ) : (
            <Button onClick={handleSetupTotp} loading={actionLoading}>
              {t.profile.enableAuthApp}
            </Button>
          )}
        </div>
      </div>

      <div className="profile-group">
        <div className="list-row list-row--header">
          <div className="list-row__icon-wrap list-row__icon-wrap--accent">
            <Icon name="envelope" size={18} />
          </div>
          <div className="list-row__content">
            <p className="list-row__title">{t.profile.emailCodes}</p>
            <p className="list-row__meta">{t.profile.emailCodesDesc}</p>
          </div>
          <StatusBadge variant={profile.emailMfaEnabled ? "enabled" : "disabled"}>
            {profile.emailMfaEnabled ? t.common.enabled : t.common.notEnabled}
          </StatusBadge>
        </div>

        <div className="list-row__panel">
          {profile.emailMfaEnabled ? (
            <Button
              variant="danger"
              onClick={handleDisableEmailMfa}
              loading={actionLoading}
            >
              {t.profile.disableEmailCodes}
            </Button>
          ) : (
            <Button onClick={handleSetupEmailMfa} loading={actionLoading}>
              {t.profile.enableEmailCodes}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
