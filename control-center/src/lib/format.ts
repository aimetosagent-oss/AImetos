export const formatNumber = (value: number | null, fallback = "—") =>
  value === null ? fallback : new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 1 }).format(value);

export const formatCurrency = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("ca-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);

export const formatDateTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("ca-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
    : "Sense execucions";

export const relativeTime = (value: string) => {
  const hours = Math.round((new Date(value).getTime() - Date.now()) / 3_600_000);
  const formatter = new Intl.RelativeTimeFormat("ca", { numeric: "auto" });
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
};
