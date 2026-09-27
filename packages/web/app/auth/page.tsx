"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/features/auth/AuthForm";
import { ensureSession, hasSessionHint } from "@/lib/api";
import { resolveAuthRedirect } from "@/lib/auth-redirect";

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "true";
  const email = searchParams.get("email") || "";
  const password = searchParams.get("password") === "true";
  const [checking, setChecking] = useState(true);

  // Skip the session check for logged-out visitors (no session hint → no refresh).
  useEffect(() => {
    if (!hasSessionHint()) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    ensureSession()
      .then((ok) => {
        if (cancelled) return;
        if (ok) {
          const redirect = resolveAuthRedirect(
            searchParams.get("redirect"),
            searchParams.get("return_to"),
          );
          if (redirect.startsWith("/api/")) {
            window.location.replace(redirect);
            return;
          }
          router.replace(redirect);
          return;
        }
        setChecking(false);
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  if (checking) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-app">
        <div className="loading__spinner" />
      </div>
    );
  }

  return (
    <AuthForm
      initialMode="login"
      registered={registered}
      initialEmail={email}
      initialLoginStep={password ? "password" : "email"}
    />
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-svh items-center justify-center bg-app">
        <div className="loading__spinner" />
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  );
}
