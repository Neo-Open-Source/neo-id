"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";

export default function AdminIndexPage() {
  const { t } = useI18n();
  usePageTitle(t.pages.admin);
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/users");
  }, [router]);

  return (
    <div className="loading">
      <div className="loading__spinner" />
    </div>
  );
}
