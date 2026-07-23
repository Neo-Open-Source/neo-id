"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/features/auth/AuthForm";

function AuthPageContent() {
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "true";
  const email = searchParams.get("email") || "";
  const password = searchParams.get("password") === "true";

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
      <div className="grid grid-cols-1 md:grid-cols-auth min-h-svh bg-surface">
        <div className="flex min-w-0 p-6 md:p-8"><div className="flex flex-1 w-full max-w-md" /></div>
        <aside className="relative hidden md:block overflow-hidden rounded-l-hero bg-auth-gradient" />
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  );
}
