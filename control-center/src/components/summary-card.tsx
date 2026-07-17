import type { ReactNode } from "react";

export function SummaryCard({ eyebrow, value, detail, icon, tone = "blue", href }: { eyebrow: string; value: string; detail: string; icon: ReactNode; tone?: "blue" | "cyan" | "green" | "amber"; href: string }) {
  return (
    <a className={`summary-card tone-${tone}`} href={href}>
      <span className="summary-icon">{icon}</span>
      <span className="summary-copy"><span className="eyebrow">{eyebrow}</span><strong>{value}</strong><small>{detail}</small></span>
      <span className="summary-arrow" aria-hidden="true">↗</span>
    </a>
  );
}
