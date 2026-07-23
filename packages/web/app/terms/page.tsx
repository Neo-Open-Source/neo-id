"use client";

import { useRouter } from "next/navigation";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { BackButton } from "@/components/ui/BackButton";
import { usePageTitle } from "@/lib/use-page-title";
import { useI18n } from "@/lib/i18n/context";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="legal-section">
      <h2 className="legal-section__title">{title}</h2>
      <p className="legal-section__body">{children}</p>
    </section>
  );
}

export default function TermsPage() {
  const router = useRouter();
  const { t } = useI18n();
  usePageTitle(t.pages.terms);
  return (
    <div className="legal-root">
      <nav className="legal-nav">
        <BackButton onClick={() => router.back()} label={t.legal.back} className="legal-back" />
      </nav>

      <main className="legal-main">
        <header className="legal-header">
          <h1>{t.legal.termsTitle}</h1>
          <p className="legal-header__date">{t.legal.updated}</p>
        </header>

        {t.legal.terms.map((s, i) => (
          <Section key={i} title={s.title}>{s.body}</Section>
        ))}
      </main>

      <ScrollToTop />
    </div>
  );
}
