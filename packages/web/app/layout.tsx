import type { Metadata } from "next";
import "@/styles/base.css";

export const metadata: Metadata = {
  title: "Neo ID",
  description: "Auth/OIDC Provider",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
