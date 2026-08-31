"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";

interface ConsentData {
  client_name: string;
  client_logo: string | null;
  scopes: string[];
  redirect_uri: string;
}

function ConsentContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [infoLoading, setInfoLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consentData, setConsentData] = useState<ConsentData | null>(null);

  const session = searchParams.get("session") || "";

  usePageTitle(consentData ? `${t.oauth.authorizeTitle} ${consentData.client_name}` : t.oauth.authorizeTitle);

  useEffect(() => {
    if (!session) {
      setError(t.oauth.invalidSession);
      setInfoLoading(false);
      return;
    }
    fetch(`/api/v1/oauth/consent/${session}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setConsentData(data.data);
        } else {
          setError(t.oauth.invalidSession);
        }
      })
      .catch(() => setError(t.auth.errors.network))
      .finally(() => setInfoLoading(false));
  }, [session, t]);

  const scopeLabels: Record<string, string> = {
    openid: t.oauth.scopeOpenid,
    profile: t.oauth.scopeProfile,
    email: t.oauth.scopeEmail,
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
      } else {
        setError(data.error?.message || t.common.unknownError);
      }
    } catch {
      setError(t.auth.errors.network);
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/oauth/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ session, approved: false }),
      });
      const data = await res.json();
      if (data.ok && data.data?.redirect_url) {
        window.location.href = data.data.redirect_url;
      } else {
        router.push("/profile");
      }
    } catch {
      router.push("/profile");
    } finally {
      setLoading(false);
    }
  };

  if (infoLoading) {
    return (
      <AuthLayout title={t.oauth.authorizeTitle} subtitle="">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AuthLayout>
    );
  }

  if (error || !consentData) {
    return (
      <AuthLayout title={t.common.error} subtitle="">
        <div className="alert alert--error">{error || t.common.unknownError}</div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={`${t.oauth.authorizeTitle} ${consentData.client_name}`}
      subtitle={t.oauth.authorizeSubtitle}
    >
      <div className="flex flex-col gap-5 animate-fadeIn">
        {consentData.client_logo && (
          <div className="flex justify-center">
            <Image
              src={consentData.client_logo}
              alt={consentData.client_name}
              width={64}
              height={64}
              className="rounded-2xl object-cover"
              unoptimized
            />
          </div>
        )}

        <div className="bg-surface-hover rounded-xl p-4">
          <p className="text-sm font-medium text-content mb-3">{t.oauth.requestedPermissions}</p>
          <div className="flex flex-col gap-2">
            {consentData.scopes.map((scope) => (
              <div key={scope} className="flex items-center gap-3 text-sm">
                <Icon name="check-circle" size={16} className="text-success shrink-0" />
                <span className="text-muted">{scopeLabels[scope] ?? scope}</span>
              </div>
            ))}
          </div>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleDeny} disabled={loading} className="flex-1">
            {t.common.cancel}
          </Button>
          <Button onClick={handleApprove} loading={loading} className="flex-1">
            {t.oauth.authorize}
          </Button>
        </div>

        <p className="text-xs text-dim text-center">{t.oauth.byAuthorizing}</p>
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
