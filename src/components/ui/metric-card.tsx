import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cx } from "./cx";

export interface MetricCardProps {
  label: string;
  value: string | number;
  detail?: string;
  icon: LucideIcon;
  href?: string;
  tone?: "petrol" | "blue" | "success" | "warning" | "danger";
  className?: string;
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  href,
  tone = "petrol",
  className,
}: MetricCardProps) {
  const content = (
    <>
      <div className={cx("metric-card__icon", `metric-card__icon--${tone}`)}>
        <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <div className="metric-card__body">
        <span className="metric-card__label">{label}</span>
        <strong className="metric-card__value">{value}</strong>
        {detail ? <span className="metric-card__detail">{detail}</span> : null}
      </div>
    </>
  );

  if (href) {
    return (
      <Link className={cx("metric-card", "metric-card--link", className)} href={href}>
        {content}
      </Link>
    );
  }

  return <article className={cx("metric-card", className)}>{content}</article>;
}
