"use client";

import { useState, Suspense } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";

function ConsentContent() {
  const { t } = useI18n();
  usePageTitle("Authorize Application");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = searchParams.get("client_name") || "Unknown App";
  const clientLogo = searchParams.get("client_logo");
  const redirectUri = searchParams.get("redirect_uri") || "";
  const scopes = searchParams.get("scopes")?.split(",") || [];
  const state = searchParams.get("state") || "";
  const session = searchParams.get("session") || "";

  const scopeDescriptions: Record<string, string> = {
    openid: "View your identity information",
    profile: "View your profile information",
    email: "View your email address",
  };

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/oauth/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ session, approved: true }),
      });
      const data = await res.json();
      if (data.ok && data.data?.redirect_url) {
        window.location.href = data.data.redirect_url;
      } else if (data.ok && redirectUri) {
        const url = new URL(redirectUri);
        url.searchParams.set("code", data.data?.code || "");
        url.searchParams.set("state", state);
        window.location.href = url.toString();
      } else {
        setError(data.error?.message || "Consent failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = () => {
    if (redirectUri) {
      const url = new URL(redirectUri);
      url.searchParams.set("error", "access_denied");
      url.searchParams.set("state", state);
      window.location.href = url.toString();
    } else {
      router.push("/profile");
    }
  };

  return (
    <AuthLayout title={`Authorize ${clientName}`} subtitle="This application wants to access your account">
      <div className="flex flex-col gap-5 animate-fadeIn">
        {clientLogo && (
          <div className="flex justify-center">
            <Image src={clientLogo} alt={clientName} width={64} height={64} className="rounded-2xl object-cover" unoptimized />
          </div>
        )}

        <div className="bg-surface-hover rounded-xl p-4">
          <p className="text-sm font-medium text-content mb-3">Requested permissions:</p>
          <div className="flex flex-col gap-2">
            {scopes.map((scope) => (
              <div key={scope} className="flex items-center gap-3 text-sm">
                <Icon name="check-circle" size={16} className="text-success shrink-0" />
                <span className="text-muted">{scopeDescriptions[scope] || scope}</span>
              </div>
            ))}
          </div>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleDeny} className="flex-1">
            {t.common.cancel}
          </Button>
          <Button onClick={handleApprove} loading={loading} className="flex-1">
            Authorize
          </Button>
        </div>

        <p className="text-xs text-dim text-center">
          By authorizing, you allow this app to access the requested information.
        </p>
      </div>
    </AuthLayout>
  );
}

export default function OAuthConsentPage() {
  return (
    <Suspense fallback={<div className="flex h-svh w-screen items-center justify-center bg-surface" />}>
      <ConsentContent />
    </Suspense>
  );
}
