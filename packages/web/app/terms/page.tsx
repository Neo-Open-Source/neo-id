"use client";

import { useRouter } from "next/navigation";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { BackButton } from "@/components/ui/BackButton";
import { Footer } from "@/components/layout/Footer";
import { LanguagePicker } from "@/components/features/auth/LanguagePicker";
import { usePageTitle } from "@/lib/use-page-title";
import { useI18n } from "@/lib/i18n/context";

import Link from "next/link";

const EMAIL_RE = /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/;
// Matches both [text](https://...) and [text](/path)
const MD_LINK_RE = /(\[[^\]]+\]\((?:https?:\/\/|\/)[^)]+\))/;
const SPLIT_RE = new RegExp(`${MD_LINK_RE.source}|${EMAIL_RE.source}`, "g");

function renderBody(text: string): React.ReactNode {
  const parts = text.split(SPLIT_RE).filter((p) => p !== undefined && p !== "");
  return parts.map((part, i) => {
    const md = part.match(/^\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)]+)\)$/);
    if (md) {
      const [, label, href] = md;
      const isInternal = href.startsWith("/");
      return isInternal ? (
        <Link key={i} href={href} className="legal-link">
          {label}
        </Link>
      ) : (
        <a key={i} href={href} className="legal-link" target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      );
    }
    if (EMAIL_RE.test(part))
      return (
        <a key={i} href={`mailto:${part}`} className="legal-link">
          {part}
        </a>
      );
    return part;
  });
}

function Section({ title, body }: { title: string; body: string }) {
  // Split "17. Title text" into ["17.", "Title text"]
  const match = title.match(/^(\d+\.)\s+(.+)$/);
  return (
    <section className="legal-section">
      <h2 className="legal-section__title">
        {match ? (
          <>
            <span className="legal-section__title-num">{match[1]}</span>
            {match[2]}
          </>
        ) : title}
      </h2>
      <p className="legal-section__body">{renderBody(body)}</p>
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
        <BackButton onClick={() => { if (window.history.length > 1) router.back(); else router.push("/profile"); }} label={t.legal.back} className="legal-back" />
        <LanguagePicker />
      </nav>

      <main className="legal-main">
        <header className="legal-header">
          <h1>{t.legal.termsTitle}</h1>
          <p className="legal-header__date">{t.legal.updated}</p>
        </header>

        {t.legal.terms.map((s, i) => (
          <Section key={i} title={s.title} body={s.body} />
        ))}
      </main>

      <ScrollToTop />
      <Footer />
    </div>
  );
}
