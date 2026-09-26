"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";
import { api, ApiError, logoutSession } from "@/lib/api";
import { clearAllCaches } from "@/lib/cache";
import { CodeInput } from "@/components/ui/CodeInput";

export default function AgeConsentPage() {
  const { t } = useI18n();
  usePageTitle(t.auth.age.title);
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!confirmed || loading) return;
    setLoading(true);
    setError(null);
    try {
      await api("/user/age-consent", { method: "POST", body: { confirmed: true } });
      clearAllCaches();
      router.push("/profile");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    if (loading) return;
    setLoading(true);
    setDeleteError(null);
    try {
      await api("/user/delete/send-code", { method: "POST" });
      setCodeSent(true);
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (loading || code.trim().length === 0) return;
    setLoading(true);
    setDeleteError(null);
    try {
      await api("/user", {
        method: "DELETE",
        body: { method: "email", code: code.trim() },
      });
      clearAllCaches();
      await logoutSession();
      router.replace("/auth");
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  if (deleting) {
    return (
      <AuthLayout
        title={t.profile.under16Title}
        subtitle={t.profile.under16Desc}
      >
        <div className="flex flex-col gap-5 animate-fadeIn">
          {!codeSent ? (
            <Button onClick={handleSendCode} loading={loading} className="w-full">
              {t.profile.sendCode}
            </Button>
          ) : (
            <>
              <p className="text-sm text-muted">{t.profile.codeSent}</p>
              <CodeInput
                value={code}
                onChange={setCode}
                autoFocus
              />
            </>
          )}

          {deleteError && <div className="alert alert--error">{deleteError}</div>}

          {codeSent && (
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={loading}
              disabled={code.trim().length === 0}
              className="w-full"
            >
              {t.profile.confirmDeleteAccount}
            </Button>
          )}
          <Button variant="ghost" onClick={() => { setDeleting(false); setCodeSent(false); setCode(""); setDeleteError(null); }} disabled={loading} className="w-full">
            {t.common.back}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t.auth.age.title}
      subtitle={t.auth.age.subtitle}
    >
      <div className="flex flex-col gap-5 animate-fadeIn">
        <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-accent/12">
          <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-border text-accent accent-accent cursor-pointer"
          />
          <span className="text-sm text-muted leading-snug">
            {t.auth.register.ageConfirm}
          </span>
        </label>

        {error && <div className="alert alert--error">{error}</div>}

        <Button onClick={handleConfirm} loading={loading} disabled={!confirmed} className="w-full">
          {t.auth.login.continue}
        </Button>

        <button
          type="button"
          onClick={() => { setDeleting(true); setError(null); }}
          className="text-sm text-muted hover:text-content transition-colors cursor-pointer"
        >
          {t.profile.under16Instead}
        </button>
      </div>
    </AuthLayout>
  );
}
