"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/features/auth/AuthForm";
import { ensureSession } from "@/lib/api";

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "true";
  const email = searchParams.get("email") || "";
  const password = searchParams.get("password") === "true";
  const [checking, setChecking] = useState(true);

  // Rehydrate session from cookie / localStorage so a closed tab doesn't
  // leave the user stuck on /auth while a valid refresh token still exists.
  useEffect(() => {
    let cancelled = false;
    ensureSession()
      .then((ok) => {
        if (cancelled) return;
        if (ok) {
          const redirect = searchParams.get("redirect") || "/profile";
          router.replace(redirect.startsWith("/") ? redirect : "/profile");
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
