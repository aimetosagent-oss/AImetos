import { ExternalLink, PlayCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SourceStrip } from "@/components/source-strip";
import { StatusDot } from "@/components/status-dot";
import { getControlCenterData } from "@/lib/data";
import { formatDateTime } from "@/lib/format";

export const revalidate = 300;

export default async function AgentsPage() {
  const data = await getControlCenterData();
  return <><PageHeader eyebrow="n8n · només lectura" title="Agents" description="Salut, última execució i incidències dels workflows que importen." /><SourceStrip data={data} /><section className="kpi-row"><div><span>Operatius</span><strong>{data.agents.filter((agent) => agent.health === "ok").length}</strong></div><div><span>Amb incidències</span><strong>{data.agents.filter((agent) => agent.health !== "ok").length}</strong></div><div><span>Actius</span><strong>{data.agents.filter((agent) => agent.active).length}</strong></div></section><section className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Agent</th><th>Estat</th><th>Freqüència</th><th>Última execució</th><th>Resultat</th><th /></tr></thead><tbody>{data.agents.map((agent) => <tr key={agent.id}><td><div className="primary-cell"><span className="table-icon"><PlayCircle size={17} /></span><div><strong>{agent.name}</strong><small>{agent.active ? "Workflow actiu" : "Workflow aturat"}</small></div></div></td><td><StatusDot health={agent.health} /></td><td>{agent.cadence}</td><td>{formatDateTime(agent.lastRun)}</td><td><span className={agent.error ? "text-warning" : "text-muted"}>{agent.error || `${agent.processed || 0} elements processats`}</span></td><td>{agent.url ? <a className="icon-link" href={agent.url} target="_blank" rel="noreferrer" aria-label={`Obrir ${agent.name} a n8n`}><ExternalLink size={16} /></a> : null}</td></tr>)}</tbody></table></div></section></>;
}
