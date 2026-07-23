"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MfaCodeForm } from "@/components/features/auth/MfaCodeForm";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";

function MfaContent() {
  const { t } = useI18n();
  usePageTitle(t.pages.verifyCode);
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const emailHint = searchParams.get("emailHint") || "";
  const mode = searchParams.get("mode") === "setup" ? "setup" : "login";
  const purpose = searchParams.get("purpose") || undefined;

  return (
    <MfaCodeForm
      method="email"
      email={email}
      emailHint={emailHint}
      mode={mode}
      purpose={purpose}
      onBack={() => {
        if (mode === "setup") {
          router.push("/profile/mfa");
          return;
        }
        if (purpose === "verify_email") {
          router.push("/auth");
          return;
        }
        if (purpose === "export") {
          router.push("/profile");
          return;
        }
        router.push(`/auth/2fa?${searchParams.toString()}`);
      }}
    />
  );
}

export default function EmailMfaPage() {
  return (
    <Suspense fallback={<div className="flex h-svh w-screen items-center justify-center bg-surface" />}>
      <MfaContent />
    </Suspense>
  );
}
