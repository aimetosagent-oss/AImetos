import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AImetos CRM", template: "%s · AImetos CRM" },
  description: "CRM comercial intern d’AImetos",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ca" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
