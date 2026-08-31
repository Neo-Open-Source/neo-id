"use client";

import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n/context";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children, initialLocale }: { children: ReactNode; initialLocale?: string }) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      {children}
      <Toaster />
    </I18nProvider>
  );
}
