"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";
import { api, ApiError } from "@/lib/api";

export default function AgeConsentPage() {
  const { t } = useI18n();
  usePageTitle("Age Verification");
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!confirmed || loading) return;
    setLoading(true);
    setError(null);
    try {
      await api("/user/age-consent", { method: "POST", body: { confirmed: true } });
      router.push("/profile");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Age Verification"
      subtitle="Before using Neo ID, confirm your age."
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
            I confirm that I am at least 16 years old
          </span>
        </label>

        {error && <div className="alert alert--error">{error}</div>}

        <Button onClick={handleConfirm} loading={loading} disabled={!confirmed} className="w-full">
          Continue
        </Button>
      </div>
    </AuthLayout>
  );
}
