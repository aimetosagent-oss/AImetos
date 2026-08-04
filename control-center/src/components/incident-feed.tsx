import { AlertTriangle, Bot, CircleDollarSign, FolderKanban, Megaphone, UserRoundSearch } from "lucide-react";
import { relativeTime } from "@/lib/format";
import type { Incident } from "@/lib/types";

const icons = { agent: Bot, lead: UserRoundSearch, project: FolderKanban, finance: CircleDollarSign, social: Megaphone };

export function IncidentFeed({ incidents }: { incidents: Incident[] }) {
  if (!incidents.length) return <div className="empty-state"><span className="empty-icon">✓</span><strong>Tot sota control</strong><p>No hi ha incidències que requereixin atenció.</p></div>;
  return <div className="incident-list">{incidents.map((incident) => { const Icon = icons[incident.category] || AlertTriangle; return <a href={incident.href || "#"} className="incident" key={incident.id}><span className={`incident-icon severity-${incident.severity}`}><Icon size={18} /></span><span className="incident-copy"><strong>{incident.title}</strong><small>{incident.detail}</small></span><time>{relativeTime(incident.occurredAt)}</time></a>; })}</div>;
}
