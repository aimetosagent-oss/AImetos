import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AImetos Control Center",
  description: "Mapa general d’agents, leads, projectes, finances i contingut d’AImetos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ca"><body>{children}</body></html>;
}
