"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";
import { api, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  usePageTitle(t.auth.forgotPassword.title);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) setEmail(emailParam);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim() },
        token: false,
      });
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout
        title={t.auth.forgotPassword.success}
        subtitle={t.auth.forgotPassword.sentTo.replace("{{email}}", email)}
        onBack={() => router.push("/auth")}
        backLabel={t.auth.forgotPassword.backToLogin}
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-success/12">
            <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-muted text-center">
            {t.auth.forgotPassword.checkInbox}
          </p>
          <Button type="button" onClick={() => router.push("/auth")} className="w-full">
            {t.auth.forgotPassword.backToLogin}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t.auth.forgotPassword.title}
      subtitle={t.auth.forgotPassword.subtitle}
      onBack={() => router.push("/auth")}
      backLabel={t.auth.forgotPassword.backToLogin}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-accent/12">
          <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>

        <div className="input-wrapper">
          <label className="input-label">{t.auth.email}</label>
          <input
            type="email"
            className="input"
            placeholder={t.auth.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        <Button type="submit" loading={loading} disabled={!email.trim()} className="w-full">
          {t.auth.forgotPassword.button}
        </Button>
      </form>
    </AuthLayout>
  );
}
