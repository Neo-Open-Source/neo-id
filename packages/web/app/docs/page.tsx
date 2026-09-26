"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";
import { Icon } from "@/components/ui/Icon";

export default function ApiDocsPage() {
  const { t } = useI18n();
  usePageTitle(t.pages.apiDocs);
  return (
    <div className="docs-page">
      <Link href="/developer/services" className="docs-page__back" aria-label={t.common.back}>
        <Icon name="arrow-left" size={16} />
        <span>{t.developer.backToServices}</span>
      </Link>
      <iframe
        className="docs-page__frame"
        title="API reference"
        src="/api-reference.html"
      />
    </div>
  );
}
