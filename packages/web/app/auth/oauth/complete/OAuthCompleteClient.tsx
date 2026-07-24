"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setSessionTokens } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";

export default function OAuthCompletePage() {
  const { t } = useI18n();
  usePageTitle(t.pages.signingIn);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ticket = searchParams.get("ticket");
    if (!ticket) {
      setError("missing_ticket");
      return;
    }

    fetch("/api/v1/auth/oauth/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ticket }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!json.ok) throw new Error(json.error?.message || "oauth_failed");
        if (json.data?.accessToken || json.data?.refreshToken) {
          setSessionTokens({
            accessToken: json.data.accessToken,
            refreshToken: json.data.refreshToken,
          });
        }
        router.replace("/profile");
      })
      .catch(() => setError("oauth_failed"));
  }, [router, searchParams]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => router.replace("/auth"), 1500);
    return () => window.clearTimeout(timer);
  }, [error, router]);

  if (error) {
    return (
      <div className="loading">
        <p className="text-sm text-muted">OAuth sign-in failed. Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="loading">
      <div className="loading__spinner" />
    </div>
  );
}
