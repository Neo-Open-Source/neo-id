"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { LanguagePicker } from "@/components/features/auth/LanguagePicker";
import { BackButton } from "@/components/ui/BackButton";
import { useI18n } from "@/lib/i18n/context";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}

export function AuthLayout({ title, subtitle, children, onBack, backLabel }: AuthLayoutProps) {
  const { t } = useI18n();

  return (
    <div className="auth-shell grid grid-cols-1 md:grid-cols-auth min-h-svh bg-surface">
      <div className="flex min-w-0 p-6 md:p-8 overflow-y-auto">
        <div
          className={cn(
            "flex flex-1 w-full max-w-md m-auto flex-col",
            "min-h-svh md:min-h-[calc(100svh-4rem)]",
          )}
        >
          <div className="flex items-center justify-between pt-6 md:pt-8 pb-8">
            <div className="inline-flex items-center gap-2 text-content text-base font-bold tracking-tight">
              <img src="/splash-icon.png" alt="Neo ID" className="w-7 h-7" />
              <span>Neo ID</span>
            </div>
            <LanguagePicker />
          </div>
          <div className="flex flex-1 flex-col justify-center gap-8">
            {onBack && (
              <BackButton onClick={onBack} label={backLabel || t.common.back} className="mb-0" />
            )}
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold text-content">{title}</h1>
              {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
            </div>
            {children}
          </div>

          <p className="py-6 md:py-8 text-xs leading-snug text-dim text-center">
            {t.auth.legal.agreePrefix}{" "}
            <Link href="/terms" className="text-accent underline">{t.auth.legal.terms}</Link>{" "}
            {t.auth.legal.agreeSuffix}{" "}
            <Link href="/privacy" className="text-accent underline">{t.auth.legal.privacy}</Link>.
          </p>
        </div>
      </div>
      <aside
        className="relative hidden md:block overflow-hidden rounded-l-hero bg-auth-gradient"
        aria-hidden="true"
      />
    </div>
  );
}
