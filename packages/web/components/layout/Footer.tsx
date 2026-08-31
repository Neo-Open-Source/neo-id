"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

function NeoLogo() {
  return (
    <svg
      viewBox="10 4 306 119"
      width="auto"
      height="24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="footer__logo"
    >
      <defs>
        <linearGradient id="footerN" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#C3DBE3" />
          <stop offset="100%" stopColor="#626E97" />
        </linearGradient>
      </defs>
      <path
        fill="url(#footerN)"
        d="M24.53 112.81a5.5 5.5 0 0 1-2.58-1.9c-1.08-1.55-1.05-.6-1.05-25.71 0-15.08.08-23.91.21-25.29a51.5 51.5 0 0 1 10.57-26.39 68 68 0 0 1 8.77-8.67 51 51 0 0 1 23.62-9.86c3.02-.41 8.42-.54 11.17-.29a48.5 48.5 0 0 1 36.5 21.69 53 53 0 0 1 8.67 25.95c.33 4.53.17 46.14-.15 47.11a6 6 0 0 1-2.56 2.94l-1.06.6-6.54.06c-7.28.08-7.94-.02-9.29-1.12a8 8 0 0 1-1.26-1.51l-.52-.91-.12-23.72c-.1-23.16-.12-23.78-.52-25.87-1.8-9.37-7.53-17.12-15.61-21.07a24.4 24.4 0 0 0-13.09-2.59c-6.85.39-10.9 1.92-16.81 6.39a29.6 29.6 0 0 0-9.93 16.71l-.45 1.94-.1 23.91c-.12 22.48-.14 23.95-.46 24.69a6 6 0 0 1-2.81 2.73c-1.01.46-1.08.46-7.45.46-4.88-.02-6.6-.08-7.16-.27z"
      />
      <path
        fill="#ffffff"
        d="m167.68 112.96-2.23-.29c-12.76-1.55-25.29-9.02-32.92-19.63-6.6-9.2-10.05-21.11-9.24-32.01a49 49 0 0 1 5.17-19.3 46 46 0 0 1 9.7-13.26 48 48 0 0 1 18.57-11.4c5.71-1.94 9.45-2.44 16.94-2.28 4.09.08 5.11.15 7.38.58a47.7 47.7 0 0 1 24.78 12.86c4.32 4.2 5.5 6.02 5.48 8.48 0 1.01-.12 1.57-.45 2.23-.56 1.08-.33.85-27.03 27.75-12.14 12.24-22.09 22.42-22.13 22.62q-.12.72 2.73 1.63c6.12 1.96 13.67 1.28 19.71-1.74 3.31-1.68 6.99-4.71 9.89-8.19 1.88-2.25 2.5-2.61 4.51-2.71 2.34-.12 2.73.14 7.59 5.07 4.71 4.78 5 5.21 5 7.57 0 1.32-.1 1.7-.56 2.61-.79 1.53-2.09 3.1-4.49 5.42-1.82 1.76-5.91 5.23-6.16 5.23-.04 0-1.05.62-2.23 1.36-1.2.76-2.19 1.36-2.25 1.36-.04 0-.6.31-1.24.68-.66.39-1.51.81-1.9.95-.41.14-1.3.52-1.99.83-2.67 1.24-7.2 2.5-11.73 3.27-1.8.31-9.55.56-10.92.35zm-15.7-44.17c2.83-2.87 9.91-10.03 15.78-15.94 15.63-15.74 14.39-14.43 13.96-14.91-.85-.95-6.23-2.13-9.7-2.13-3.16 0-7.73.85-8.87 1.67-.21.15-.58.27-.79.27-.72 0-3.99 1.72-5.94 3.12A28.8 28.8 0 0 0 145 58.34c-.35 1.63-.43 2.63-.43 5.65-.02 3.87.21 5.63 1.06 8.25.43 1.32.68 1.72 1.03 1.72.12 0 2.52-2.32 5.32-5.17"
      />
      <path
        fill="#ffffff"
        d="M251.33 112.81c-8.33-1.06-15.35-3.64-21.88-8.04-10.17-6.82-17.08-16.32-20.21-27.79a45 45 0 0 1-1.67-12.7 49 49 0 0 1 14.33-35.03 49 49 0 0 1 16.46-11.02 52 52 0 0 1 12-3.25c2.52-.37 9.26-.45 11.7-.1A50.6 50.6 0 0 1 285 23.86a49.5 49.5 0 0 1 20.35 40.12A49 49 0 0 1 295.3 93.8c-2.54 3.37-8.83 9.33-11.31 10.73-.35.19-1.1.66-1.68 1.03a48 48 0 0 1-7.75 3.91 45 45 0 0 1-2.83 1.08c-.06 0-.39.12-.72.27-.81.35-5.56 1.41-7.98 1.78-2.67.41-9.14.52-11.71.19zm9.33-20.95c2.83-.46 4.9-1.14 7.49-2.4a27 27 0 0 0 7.26-5.01 28 28 0 0 0 8.38-15.7c.43-2.44.43-6.99-.02-9.49a28.6 28.6 0 0 0-15.14-20.49c-4.53-2.27-10.11-3.33-14.72-2.77a35 35 0 0 0-7.22 1.78c-4.69 2.11-7.01 3.68-9.91 6.72a29 29 0 0 0-7.61 14.93c-.39 2.3-.41 6.53-.02 8.83a28.3 28.3 0 0 0 31.51 23.61z"
      />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.99432,2a10,10,0,1,0,10,10A9.99917,9.99917,0,0,0,11.99432,2Zm3.17951,15.15247a.70547.70547,0,0,1-1.002.3515l-2.71467-2.10938L9.71484,17.002a.29969.29969,0,0,1-.285.03894l.334-2.98846.01069.00848.00683-.059s4.885-4.44751,5.084-4.637c.20147-.189.135-.23.135-.23.01147-.23053-.36152,0-.36152,0L8.16632,13.299l-2.69549-.918s-.414-.1485-.453-.475c-.041-.324.46649-.5.46649-.5l10.717-4.25751s.881-.39252.881.25751Z"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.01-2.13-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.66.8.55A11.51 11.51 0 0 0 23.5 12c0-6.35-5.15-11.5-11.5-11.5z"/>
    </svg>
  );
}

interface FooterLink {
  labelKey: string;
  href: string;
}

const ECOSYSTEM_LINKS: FooterLink[] = [
  { labelKey: "blog", href: "https://blog.neome.uk" },
  { labelKey: "api", href: "https://api.neome.uk" },
  { labelKey: "neoid", href: "/" },
];

const COMMUNITY_LINKS: FooterLink[] = [
  { labelKey: "telegram", href: "https://t.me/neomovies_news" },
  { labelKey: "github", href: "https://github.com/Neo-Open-Source" },
];

export function Footer() {
  const { t } = useI18n();
  const currentYear = new Date().getFullYear();

  const footer = t.footer;
  const label = (key: string) =>
    key === "blog"
      ? footer.blog
      : key === "api"
        ? footer.api
        : key === "neoid"
          ? footer.neoid
          : key === "telegram"
            ? footer.telegram
            : footer.github;

  const renderLink = (link: FooterLink) => {
    if (link.href.startsWith("/")) {
      return (
        <Link href={link.href} className="footer__link">
          <span>{label(link.labelKey)}</span>
        </Link>
      );
    }
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className="footer__link"
      >
        {link.labelKey === "telegram" && <TelegramIcon />}
        {link.labelKey === "github" && <GitHubIcon />}
        <span>{label(link.labelKey)}</span>
      </a>
    );
  };

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__top">
          <NeoLogo />
          <div className="footer__cols">
            <div className="footer__col">
              <h3 className="footer__heading">{footer.ecosystem}</h3>
              <ul className="footer__list">
                {ECOSYSTEM_LINKS.map((l) => (
                  <li key={l.href}>{renderLink(l)}</li>
                ))}
              </ul>
            </div>
            <div className="footer__col">
              <h3 className="footer__heading">{footer.community}</h3>
              <ul className="footer__list">
                {COMMUNITY_LINKS.map((l) => (
                  <li key={l.href}>{renderLink(l)}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="footer__bottom">
          <span className="footer__copyright">{footer.copyright.replace("{{year}}", String(currentYear))}</span>
          <Link href="/terms" className="footer__link">
            {footer.tos}
          </Link>
          <Link href="/privacy" className="footer__link">
            {footer.privacy}
          </Link>
        </div>
      </div>
    </footer>
  );
}
