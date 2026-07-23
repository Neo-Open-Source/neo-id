"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";
import { api, ApiError } from "@/lib/api";

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  usePageTitle(t.auth.resetPassword.title);

  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = searchParams.get("token") || "";
    setToken(t);
    if (!t) setError("Invalid or missing reset link");
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !password || loading) return;

    if (password !== confirmPassword) {
      setError(t.auth.resetPassword.passwordsMismatch);
      return;
    }

    if (password.length < 8) {
      setError(t.auth.resetPassword.passwordTooShort);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: { token, newPassword: password },
        token: false,
      });
      setSuccess(true);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t.common.error;
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout
        title={t.auth.resetPassword.success}
        subtitle={t.auth.resetPassword.successDesc}
        onBack={() => router.push("/auth")}
        backLabel={t.auth.forgotPassword.backToLogin}
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-success/12">
            <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <Button type="button" onClick={() => router.push("/auth")} className="w-full">
            {t.auth.forgotPassword.backToLogin}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t.auth.resetPassword.title}
      subtitle={t.auth.resetPassword.subtitle}
      onBack={() => router.push("/auth")}
      backLabel={t.auth.forgotPassword.backToLogin}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="input-wrapper">
          <label className="input-label">{t.auth.password}</label>
          <input
            type="password"
            name="new-password"
            className="input"
            placeholder={t.auth.passwordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            autoComplete="new-password"
          />
        </div>

        <div className="input-wrapper">
          <label className="input-label">{t.auth.resetPassword.confirmPassword}</label>
          <input
            type="password"
            name="confirm-password"
            className="input"
            placeholder={t.auth.passwordPlaceholder}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        <Button type="submit" loading={loading} disabled={!token || !password || !confirmPassword} className="w-full">
          {t.auth.resetPassword.button}
        </Button>
      </form>
    </AuthLayout>
  );
}
