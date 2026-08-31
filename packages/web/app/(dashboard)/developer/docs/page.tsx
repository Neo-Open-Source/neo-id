"use client";

import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";

export default function DeveloperDocsPage() {
  const { t } = useI18n();
  usePageTitle(t.pages.apiDocs);
  return (
    <iframe
      className="scalar-frame"
      title="API reference"
      src="/api-reference.html"
    />
  );
}
