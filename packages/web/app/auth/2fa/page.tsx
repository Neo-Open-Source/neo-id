"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";

function PickerContent() {
  const { t } = useI18n();
  usePageTitle(t.pages.twoFactor);
  const router = useRouter();
  const searchParams = useSearchParams();

  const email = searchParams.get("email") || "";
  const methods = searchParams.get("methods")?.split(",").filter(Boolean) || [];
  const emailHint = searchParams.get("emailHint") || "";
  const requiresPassword = searchParams.get("prePassword") === "true";
  const redirect = searchParams.get("redirect") || "";
  const redirectParam = redirect ? `&redirect=${encodeURIComponent(redirect)}` : "";

  const availableMethods =
    requiresPassword &&
    (methods.length === 0 || (methods.length === 1 && methods[0] === "passkey"))
      ? ["password"]
      : methods;

  const methodInfo: Record<string, { icon: string; title: string; desc: string; href: string }> = {
    passkey: {
      icon: "fingerprint",
      title: t.auth.mfa.passkey,
      desc: t.auth.mfa.passkeyDesc,
      href: "/auth/2fa/passkey",
    },
    totp: {
      icon: "shield",
      title: t.auth.mfa.totp,
      desc: t.auth.mfa.totpDesc,
      href: "/auth/2fa/totp",
    },
    email: {
      icon: "envelope",
      title: t.auth.mfa.emailCode,
      desc: `${t.auth.mfa.emailCodeDesc} ${emailHint}`.trim(),
      href: "/auth/2fa/mfa",
    },
    password: {
      icon: "key",
      title: t.auth.password,
      desc: t.auth.login.usePassword,
      href: "/auth",
    },
  };

  return (
    <AuthLayout
      title={t.auth.mfa.title}
      subtitle={t.auth.mfa.subtitle}
      onBack={() => {
        const purpose = searchParams.get("purpose");
        if (purpose === "export" || purpose === "delete") {
          router.push("/profile");
          return;
        }
        router.push(`/auth?email=${encodeURIComponent(email)}${redirectParam}`);
      }}
      backLabel={t.common.back}
    >
      <div className="flex flex-col gap-3 animate-[slideUp_250ms_ease-out]">
        {availableMethods.map((method) => {
          const info = methodInfo[method];
          if (!info) return null;
          return (
            <button
              key={method}
              type="button"
              onClick={() => {
                if (method === "password" || (requiresPassword && method !== "passkey")) {
                  router.push(`/auth?email=${encodeURIComponent(email)}&password=true${redirectParam}`);
                  return;
                }
                router.push(`${info.href}?${searchParams.toString()}`);
              }}
              className="flex items-center gap-3 px-5 py-4 bg-surface border border-border rounded-card hover:bg-surface-hover transition-colors text-left cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <Icon name={info.icon} size={20} className="text-accent" />
              </div>
              <div>
                <div className="text-sm font-medium text-content">{info.title}</div>
                <div className="text-xs text-muted">{info.desc}</div>
              </div>
              {requiresPassword && method !== "passkey" && (
                <Icon name="lock" size={16} className="ml-auto text-dim" />
              )}
            </button>
          );
        })}
      </div>
    </AuthLayout>
  );
}

export default function TwoFactorPage() {
  return (
    <Suspense fallback={<div className="flex h-svh w-screen items-center justify-center bg-surface" />}>
      <PickerContent />
    </Suspense>
  );
}
