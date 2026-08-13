"use client";

import { useCallback, useEffect, Suspense, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { setSessionTokens } from "@/lib/api";
import { resolveAuthRedirect } from "@/lib/auth-redirect";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";

function base64UrlToBuffer(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function bufferToBase64Url(buffer: ArrayBuffer | null) {
  if (!buffer) return null;
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function PasskeyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  usePageTitle(t.pages.passkey);
  const email = searchParams.get("email") || "";
  const fallback = searchParams.get("fallback") === "password";
  const redirect = resolveAuthRedirect(searchParams.get("redirect"));
  const redirectParam = redirect !== "/profile" ? `&redirect=${encodeURIComponent(redirect)}` : "";
  const [status, setStatus] = useState<"pending" | "failed">("pending");
  const authenticatingRef = useRef(false);

  const authenticate = useCallback(async () => {
    if (!email || !window.PublicKeyCredential || authenticatingRef.current) {
      if (!email || !window.PublicKeyCredential) setStatus("failed");
      return;
    }

    authenticatingRef.current = true;
    try {
      setStatus("pending");
      const start = await fetch("/api/v1/passkeys/authenticate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const startPayload = await start.json();
      const options = startPayload.data;
      if (!start.ok || !options?.challenge || !options.allowCredentials?.length) throw new Error("passkey unavailable");

      const credential = await navigator.credentials.get({
        publicKey: {
          ...options,
          challenge: base64UrlToBuffer(options.challenge),
          allowCredentials: options.allowCredentials.map((item: { id: string; transports?: string | string[] }) => ({
            ...item,
            id: base64UrlToBuffer(item.id),
            transports: typeof item.transports === "string" ? JSON.parse(item.transports) : item.transports,
          })),
        },
      }) as PublicKeyCredential | null;
      if (!credential) throw new Error("credential unavailable");

      const assertion = credential.response as AuthenticatorAssertionResponse;
      const finish = await fetch("/api/v1/passkeys/authenticate/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          expectedChallenge: options.challenge,
          response: {
            id: credential.id,
            rawId: bufferToBase64Url(credential.rawId),
            type: credential.type,
            clientExtensionResults: credential.getClientExtensionResults(),
            response: {
              authenticatorData: bufferToBase64Url(assertion.authenticatorData),
              clientDataJSON: bufferToBase64Url(assertion.clientDataJSON),
              signature: bufferToBase64Url(assertion.signature),
              userHandle: assertion.userHandle ? bufferToBase64Url(assertion.userHandle) : null,
            },
          },
        }),
      });
      const result = await finish.json();
      if (!finish.ok || !result.ok) throw new Error("passkey verification failed");
      if (result.data?.accessToken || result.data?.refreshToken) {
        setSessionTokens({
          accessToken: result.data.accessToken,
          refreshToken: result.data.refreshToken,
        });
      }
      // Keep the OAuth authorize path so the consent screen shows after sign-in
      if (redirect.startsWith("/api/")) {
        window.location.assign(redirect);
      } else {
        router.replace(redirect);
      }
    } catch {
      setStatus("failed");
    } finally {
      authenticatingRef.current = false;
    }
  }, [email, router, redirect]);

  useEffect(() => { authenticate(); }, [authenticate]);

  const useFallback = () => {
    if (fallback) {
      router.replace(`/auth?email=${encodeURIComponent(email)}&password=true${redirectParam}`);
      return;
    }
    router.replace(`/auth/2fa?${searchParams.toString()}`);
  };

  return (
    <AuthLayout
      title={t.auth.mfa.passkey}
      subtitle={t.auth.mfa.passkeyPrompt}
      onBack={useFallback}
      backLabel={t.common.back}
    >
      <div className="flex flex-col items-center gap-6 py-8 animate-[fadeIn_300ms_ease-out]">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
          <Icon name="fingerprint" size={28} className="text-accent" />
        </div>
        {status === "pending" ? (
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        ) : (
          <p className="text-sm text-muted text-center">{t.auth.mfa.passkeyUnavailable}</p>
        )}
        <p className="text-sm text-muted text-center">{t.auth.mfa.passkeyDesc}</p>
        {status === "failed" && <Button variant="secondary" onClick={authenticate}>{t.auth.mfa.tryAgain}</Button>}
      </div>
    </AuthLayout>
  );
}

export default function PasskeyPage() {
  return <Suspense fallback={<div className="flex h-svh w-screen items-center justify-center bg-surface" />}><PasskeyContent /></Suspense>;
}
