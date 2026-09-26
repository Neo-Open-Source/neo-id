"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { CodeInput } from "@/components/ui/CodeInput";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
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

  const handleDisableMfa = async (target: "totp" | "email") => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const challenge = await api<{ methods?: string[]; email?: string; emailHint?: string }>(
        "/mfa/disable/challenge",
        { method: "POST" },
      );
      const methods = challenge?.methods?.length ? challenge.methods : ["email"];
      const params = new URLSearchParams({
        purpose: "mfa-disable",
        target,
        email: challenge?.email || profile?.email || "",
        methods: methods.join(","),
      });
      if (challenge?.emailHint) params.set("emailHint", challenge.emailHint);
      router.push(`/auth/2fa?${params.toString()}`);
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

  const handleDisableEmailMfa = () => {
    void handleDisableMfa("email");
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
            <Icon name="shield-check" size={18} />
          </div>
          <div className="list-row__content">
            <p className="list-row__title">{t.profile.authenticatorApp}</p>
            <p className="list-row__meta">{t.profile.authenticatorDesc}</p>
          </div>
          <Switch
            checked={profile.totpEnabled}
            disabled={actionLoading}
            label={t.profile.authenticatorApp}
            onChange={(next) => {
              if (next) void handleSetupTotp();
              else void handleDisableMfa("totp");
            }}
          />
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
          <Switch
            checked={profile.emailMfaEnabled}
            disabled={actionLoading}
            label={t.profile.emailCodes}
            onChange={(next) => {
              if (next) void handleSetupEmailMfa();
              else void handleDisableEmailMfa();
            }}
          />
        </div>
      </div>

      <Modal
        open={totpSetup !== null}
        onClose={() => { setTotpSetup(null); setTotpCode(""); }}
        title={t.profile.authenticatorApp}
        description={t.profile.enterCodeFromApp}
        footer={
          <>
            <Button
              variant="ghost"
              type="button"
              onClick={() => { setTotpSetup(null); setTotpCode(""); }}
              disabled={actionLoading}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="button"
              onClick={handleEnableTotp}
              loading={actionLoading}
              disabled={totpCode.length !== 6}
            >
              {t.profile.verifyAndEnable}
            </Button>
          </>
        }
      >
        {totpSetup && (
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
          </div>
        )}
      </Modal>
    </div>
  );
}
