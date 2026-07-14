import type { HTMLAttributes } from "react";

import { cx } from "./cx";

export type BadgeTone =
  | "neutral"
  | "petrol"
  | "blue"
  | "success"
  | "warning"
  | "danger";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

export function Badge({
  className,
  tone = "neutral",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cx("ui-badge", `ui-badge--${tone}`, className)} {...props}>
      {dot ? <span className="ui-badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

const statusTone: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  PENDING: "warning",
  IN_PROGRESS: "blue",
  SENT: "blue",
  VIEWED: "petrol",
  ISSUED: "blue",
  PARTIALLY_PAID: "warning",
  ACCEPTED: "success",
  PAID: "success",
  COMPLETED: "success",
  REJECTED: "danger",
  EXPIRED: "danger",
  OVERDUE: "danger",
  FAILED: "danger",
  CANCELLED: "neutral",
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  return (
    <Badge tone={statusTone[status.toUpperCase()] ?? "neutral"} dot className={className}>
      {label ?? status}
    </Badge>
  );
}
