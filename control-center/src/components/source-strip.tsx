import { Database, RefreshCw } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { ControlCenterData } from "@/lib/types";
import { StatusDot } from "./status-dot";

export function SourceStrip({ data }: { data: ControlCenterData }) {
  return <div className="source-strip"><div className="source-left"><Database size={16} /><span>{data.mode === "live" ? "Dades en directe" : data.mode === "partial" ? "Connexió parcial" : "Mode demostració"}</span></div><div className="source-items">{data.sources.map((source) => <StatusDot key={source.id} health={source.health} label={source.label} />)}</div><div className="source-time"><RefreshCw size={14} />{formatDateTime(data.generatedAt)}</div></div>;
}
