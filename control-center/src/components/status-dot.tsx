import type { Health } from "@/lib/types";

export function StatusDot({ health, label }: { health: Health; label?: string }) {
  return <span className={`status status-${health}`}><span aria-hidden="true" />{label || ({ ok: "Correcte", warning: "Atenció", error: "Error", unknown: "Desconegut" }[health])}</span>;
}
