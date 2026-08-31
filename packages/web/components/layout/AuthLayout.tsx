"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
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
    <div className="auth-shell" style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      minHeight: "100svh",
      backgroundColor: "var(--color-app)",
      padding: "0 16px",
    }}>

      {/* Everything in one centred 340px column */}
      <div style={{
        width: "100%",
        maxWidth: "340px",
        display: "flex",
        flexDirection: "column",
        flex: 1,
      }}>

        {/* Form centred vertically */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "20px",
          paddingBottom: "60px",
        }}>
          {/* Logo + language right above the form */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Image src="/splash-icon.png" alt="Neo ID" width={26} height={26} style={{ width: 26, height: 26 }} />
              <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-content)", letterSpacing: "-0.02em" }}>
                Neo ID
              </span>
            </div>
            <LanguagePicker />
          </div>

          {onBack && (
            <BackButton onClick={onBack} label={backLabel || t.common.back} className="mb-0" />
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--color-content)", letterSpacing: "-0.02em" }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{ margin: 0, fontSize: "14px", color: "var(--color-muted)" }}>
                {subtitle}
              </p>
            )}
          </div>

          {children}
        </div>

        {/* Footer */}
        <div style={{
          flexShrink: 0,
          padding: "20px 0",
          textAlign: "center",
        }}>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--color-dim)", lineHeight: 1.5 }}>
            {t.auth.legal.agreePrefix}{" "}
            <Link href="/terms" style={{ color: "var(--color-accent)" }}>{t.auth.legal.terms}</Link>{" "}
            {t.auth.legal.agreeSuffix}{" "}
            <Link href="/privacy" style={{ color: "var(--color-accent)" }}>{t.auth.legal.privacy}</Link>.
          </p>
        </div>

      </div>
    </div>
  );
}
