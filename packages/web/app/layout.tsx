import type { Metadata } from "next";
import { headers } from "next/headers";
import "@/styles/foundations.css";
import "@/styles/components.css";
import "@/styles/sections.css";
import { Providers } from "@/components/providers/Providers";

export const metadata: Metadata = {
  title: {
    template: "%s — Neo ID",
    default: "Neo ID",
  },
  description: "Auth/OIDC Provider",
};

 
const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('neo_id_theme');
    var d = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (d) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch(e) {}
})();
`;

 
const localeScript = `
(function() {
  try {
    var l = localStorage.getItem('neo_id_locale');
    if (!l) {
      var n = navigator.language.toLowerCase();
      if (n.startsWith('uk')) l = 'uk';
      else if (n.startsWith('ro')) l = 'ro';
      else if (n.startsWith('ru')) l = 'ru';
      else l = 'en';
    }
    window.__initialLocale = l;
    document.documentElement.lang = l;
  } catch(e) {
    window.__initialLocale = 'en';
  }
})();
`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const serverLocale = headersList.get("x-locale") || "en";

  return (
    <html lang={serverLocale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: localeScript }} />
        <link rel="icon" href="/favicon.png" type="image/png" />
      </head>
      <body>
        <Providers initialLocale={serverLocale}>{children}</Providers>
      </body>
    </html>
  );
}
