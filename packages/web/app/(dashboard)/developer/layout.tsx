"use client";

import { PanelShell } from "@/components/layout/PanelShell";
import { useI18n } from "@/lib/i18n/context";

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();

  return (
    <PanelShell
      items={[
        { href: "/developer/services", label: t.nav.services, icon: "apps" },
        { href: "/developer/docs", label: t.nav.apiDocs, icon: "document-signed" },
      ]}
    >
      {children}
    </PanelShell>
  );
}
