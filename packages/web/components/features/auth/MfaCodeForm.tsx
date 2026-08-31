"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { CodeInput } from "@/components/ui/CodeInput";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n/context";
import { api, ApiError, getStoredRefreshToken, logoutSession } from "@/lib/api";
import { resolveAuthRedirect } from "@/lib/auth-redirect";
import { writeCache, readCache } from "@/lib/cache";

interface MfaCodeFormProps {
  method: "totp" | "email";
  email?: string;
  emailHint?: string;
  mode?: "login" | "setup";
  purpose?: string;
  onBack?: () => void;
}

const RESEND_SECONDS = 60;

export function MfaCodeForm({
  method,
  email = "",
  mode = "login",
  purpose,
  onBack,
}: MfaCodeFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const afterLogin = resolveAuthRedirect(searchParams.get("redirect"));

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(
    method === "email" ? RESEND_SECONDS : 0,
  );

  const isExport = purpose === "export";
  const isDelete = purpose === "delete";
  const isVerifyEmail = purpose === "verify_email";
  const isEmailChange = purpose === "email_change";
  const iconName = method === "totp" ? "shield" : "envelope";
  const title = isExport || isDelete
    ? (isExport ? t.profile.exportData : t.profile.deleteAccount)
    : isEmailChange
    ? t.profile.changeEmailTitle
    : (isVerifyEmail ? t.auth.mfa.verifyEmail : (method === "totp" ? t.auth.mfa.enterTotp : t.auth.mfa.enterCode));
  const subtitle = isExport || isDelete
    ? (isExport ? t.profile.exportDesc : t.profile.deleteAccountDesc)
    : isEmailChange
    ? t.profile.emailChangeCodeHint
    : (isVerifyEmail
      ? `${t.auth.mfa.verifyEmailSubtitle} ${email}`.trim()
      : (method === "totp"
        ? t.auth.mfa.totpSubtitle
        : `${t.auth.mfa.emailSubtitle} ${email}`.trim()));
  const label = method === "totp" ? t.auth.mfa.totp : t.auth.mfa.emailCode;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldown((v) => (v <= 1 ? 0 : v - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  // Send the action verification code when the email method is chosen
  useEffect(() => {
    if ((!isExport && !isDelete) || method !== "email") return;
    api(isExport ? "/user/export/send-code" : "/user/delete/send-code", { method: "POST" }).catch(() => {});
  }, [isExport, isDelete, method]);

  // Send email change verification code on mount
  useEffect(() => {
    if (!isEmailChange || method !== "email") return;
    const newEmail = searchParams.get("newEmail") || "";
    api("/user/email/change/request", { method: "POST", body: { newEmail } }).catch(() => {});
  }, [isEmailChange, method, searchParams]);

  // Send email code when component mounts in login mode. Skipped for export /
  // email verification — those deliver their own code and sending the login
  // MFA code here was the cause of users receiving two emails.
  useEffect(() => {
    if (method !== "email" || mode !== "login" || !email) return;
    if (purpose) return;
    api("/mfa/email/resend", { method: "POST", body: { email, purpose: "mfa_login" } }).catch(() => {});
  }, [method, mode, email, purpose]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;

    setLoading(true);

    try {
      if (isExport) {
        const data = await api("/user/export", { method: "POST", body: { method, code } });
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `neo-id-data-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        router.push("/profile");
        return;
      }

      if (isDelete) {
        await api("/user", { method: "DELETE", body: { method, code } });
        await logoutSession();
        router.replace("/auth");
        return;
      }

      if (isEmailChange) {
        const newEmail = searchParams.get("newEmail") || "";
        await api("/user/email/change/confirm", { method: "POST", body: { newEmail, code } });
        router.replace("/profile");
        return;
      }

      if (mode === "setup") {
        if (method === "email") {
          await api("/mfa/email/enable", { method: "POST", body: { code } });
        } else {
          await api("/mfa/totp/enable", { method: "POST", body: { code } });
        }
        const current = readCache<Record<string, unknown>>("/user/profile");
        if (current) {
          writeCache("/user/profile", {
            ...current,
            ...(method === "email"
              ? { emailMfaEnabled: true }
              : { totpEnabled: true }),
          });
        }
        router.push("/profile/mfa");
        return;
      }

      const body: Record<string, string> = { method, code, email };
      if (purpose) body.purpose = purpose;
      // Let the server reuse this browser's existing session on re-login.
      const storedRefresh = getStoredRefreshToken();
      if (storedRefresh) body.refresh_token = storedRefresh;

      try {
        // Login MFA has no access token yet — don't force auth bootstrap
        await api("/mfa/verify", { method: "POST", body, token: false });
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : t.auth.mfa.verificationFailed;
        toast.error(msg);
        setLoading(false);
        return;
      }

      if (isVerifyEmail && afterLogin === "/profile") {
        router.push("/setup");
      } else if (afterLogin.startsWith("/api/")) {
        // OAuth authorize must be a full document navigation so 302 → consent works
        window.location.assign(afterLogin);
      } else {
        router.push(afterLogin);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.auth.errors.network);
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (method !== "email" || resendCooldown > 0) return;
    try {
      if (isExport) {
        await api("/user/export/send-code", { method: "POST" });
      } else if (isDelete) {
        await api("/user/delete/send-code", { method: "POST" });
      } else if (mode === "setup") {
        await api("/mfa/email/setup", { method: "POST" });
      } else if (email) {
        try {
          await api("/mfa/email/resend", { method: "POST", body: { email, purpose } });
        } catch (err) {
          const retry = err instanceof ApiError ? Number(err.details?.retryAfter || 0) : 0;
          if (err instanceof ApiError && err.code === "RATE_LIMITED") {
            setResendCooldown(Math.max(1, retry));
          }
          toast.error(err instanceof ApiError ? err.message : t.common.error);
          return;
        }
      }
      setCode("");
      setResendCooldown(RESEND_SECONDS);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t.auth.errors.network;
      const retry = err instanceof ApiError ? Number(err.details?.retryAfter || 0) : 0;
      if (err instanceof ApiError && err.code === "RATE_LIMITED") {
        setResendCooldown(Math.max(1, retry));
      }
      toast.error(message);
    }
  };

  return (
    <AuthLayout title={title} subtitle={subtitle} onBack={onBack} backLabel={t.common.back}>
      <div className="flex flex-col gap-5 animate-fadeIn">
        <div className="flex w-16 h-16 mx-auto items-center justify-center rounded-full bg-accent/12">
          <Icon name={iconName} size={28} className="text-accent" />
        </div>

        <form onSubmit={handleVerify} className="flex flex-col gap-5">
          <CodeInput
            label={label}
            value={code}
            onChange={setCode}
            placeholder={t.auth.mfa.codePlaceholder}
            autoFocus
          />

          <Button
            type="submit"
            loading={loading}
            disabled={code.length !== 6}
            className="w-full"
          >
            {isExport || isDelete
              ? (isExport ? t.profile.exportData : t.profile.deleteAccount)
              : (mode === "setup" ? t.profile.verifyAndEnable : t.auth.mfa.verify)}
          </Button>
        </form>

        {method === "email" && (
          <p className="m-0 text-center text-sm">
            <button
              type="button"
              className="text-accent text-sm font-medium hover:text-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleResend}
              disabled={resendCooldown > 0}
            >
              {resendCooldown > 0
                ? `${t.auth.mfa.resendCode} (${resendCooldown}s)`
                : t.auth.mfa.resendCode}
            </button>
          </p>
        )}
      </div>
    </AuthLayout>
  );
}
