"use client";

import { PanelShell } from "@/components/layout/PanelShell";
import { useI18n } from "@/lib/i18n/context";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();

  return (
    <PanelShell
      items={[
        { href: "/admin/users", label: t.nav.users, icon: "user" },
        { href: "/admin/services", label: t.nav.services, icon: "apps" },
      ]}
    >
      {children}
    </PanelShell>
  );
}
