"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, ChartNoAxesCombined, CircleDollarSign, Eye, FolderKanban, Gauge, LogOut, Megaphone, UserRoundSearch } from "lucide-react";
import type { ReactNode } from "react";

const links = [
  { href: "/", label: "General", icon: Gauge },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/leads", label: "Leads", icon: UserRoundSearch },
  { href: "/projects", label: "Projectes", icon: FolderKanban },
  { href: "/finances", label: "Finances", icon: CircleDollarSign },
  { href: "/social", label: "XXSS", icon: Megaphone },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const demo = pathname === "/demo";
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><Image src="/brand/logo-web.png" alt="AImetos" width={178} height={52} priority /><span>Control Center</span></div><nav>{links.map(({ href, label, icon: Icon }) => demo ? <span key={href} className="nav-disabled"><Icon size={18} /><span>{label}</span></span> : <Link key={href} href={href} className={pathname === href ? "active" : ""}><Icon size={18} /><span>{label}</span></Link>)}</nav><div className="sidebar-bottom"><Link href="/demo" className={demo ? "active" : ""}><Eye size={18} /><span>Mode demo</span></Link>{demo ? <Link href="/"><Gauge size={18} /><span>Tornar al privat</span></Link> : null}<form action="/api/auth/logout" method="post"><button type="submit"><LogOut size={18} /><span>Sortir</span></button></form><div className="system-mark"><ChartNoAxesCombined size={16} /><span>Lectura · 5 min</span></div></div></aside><main className="main-content">{children}</main></div>;
}
