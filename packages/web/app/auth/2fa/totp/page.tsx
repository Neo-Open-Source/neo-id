"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MfaCodeForm } from "@/components/features/auth/MfaCodeForm";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";

function TotpContent() {
  const { t } = useI18n();
  usePageTitle(t.pages.authenticatorCode);
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const emailHint = searchParams.get("emailHint") || "";
  const mode = searchParams.get("mode") === "setup" ? "setup" : "login";

  return (
    <MfaCodeForm
      method="totp"
      email={email}
      emailHint={emailHint}
      mode={mode}
      onBack={() => {
        if (mode === "setup") {
          router.push("/profile/mfa");
          return;
        }
        router.push(`/auth/2fa?${searchParams.toString()}`);
      }}
    />
  );
}

export default function TotpPage() {
  return (
    <Suspense fallback={<div className="flex h-svh w-screen items-center justify-center bg-surface" />}>
      <TotpContent />
    </Suspense>
  );
}
