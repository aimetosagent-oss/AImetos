import { Bot, CircleDollarSign, FolderKanban, UserRoundSearch } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { ControlCenterData } from "@/lib/types";
import { IncidentFeed } from "./incident-feed";
import { LineChart } from "./line-chart";
import { PageHeader } from "./page-header";
import { SourceStrip } from "./source-strip";
import { SummaryCard } from "./summary-card";

export function DashboardView({ data, demo = false }: { data: ControlCenterData; demo?: boolean }) {
  const agentErrors = data.agents.filter((agent) => agent.health !== "ok").length;
  const link = (href: string) => demo ? "/demo" : href;
  return <>
    <PageHeader eyebrow={demo ? "Vista preparada per compartir" : "Mapa general"} title={demo ? "AImetos en acció" : "Bon dia, Roger"} description={demo ? "Resultats agregats i dades anonimitzades." : "El que requereix la teva atenció, sense soroll."} action={<div className="period-pill">Últims 7 dies <span>⌄</span></div>} />
    <SourceStrip data={data} />
    <section className="summary-grid">
      <SummaryCard eyebrow="Agents" value={`${data.agents.length - agentErrors}/${data.agents.length} operatius`} detail={agentErrors ? `${agentErrors} requereixen atenció` : "Cap incidència"} icon={<Bot size={21} />} tone={agentErrors ? "amber" : "green"} href={link("/agents")} />
      <SummaryCard eyebrow="Leads" value={`+${formatNumber(data.leads.newLast7Days)}`} detail={`${formatNumber(data.leads.qualified)} qualificats · ${formatNumber(data.leads.replies)} respostes`} icon={<UserRoundSearch size={21} />} tone="cyan" href={link("/leads")} />
      <SummaryCard eyebrow="Projectes" value={`${formatNumber(data.projects.active)} actius`} detail={`${formatNumber(data.projects.blocked)} bloquejats · ${formatNumber(data.projects.hours31Days)} h`} icon={<FolderKanban size={21} />} tone="blue" href={link("/projects")} />
      <SummaryCard eyebrow="Caixa real" value={formatCurrency(data.finance.cashReal)} detail={`${data.finance.quarterLabel} · fiscal ${formatCurrency(data.finance.taxEstimate)}`} icon={<CircleDollarSign size={21} />} tone="green" href={link("/finances")} />
    </section>
    <section className="dashboard-grid">
      <article className="panel chart-panel"><div className="panel-header"><div><span className="eyebrow">Ritme comercial</span><h2>Leads nous</h2></div><div className="metric-inline"><strong>{formatNumber(data.leads.newLast7Days)}</strong><span>7 dies</span></div></div><LineChart points={data.leads.trend} /><div className="chart-footer">{data.leads.bySource.map((source, index) => <span key={source.label}><i className={`source-color color-${index}`} />{source.label} <strong>{formatNumber(source.value)}</strong></span>)}</div></article>
      <article className="panel attention-panel"><div className="panel-header"><div><span className="eyebrow">Prioritat</span><h2>Requereix atenció</h2></div><span className="count-badge">{data.incidents.length}</span></div><IncidentFeed incidents={data.incidents} /></article>
    </section>
    <section className="decision-card"><div><span className="eyebrow">Decisió de contingut</span><h2>{data.social.decision}</h2><p>{data.social.winningChannel} · {data.social.winningFormat}</p></div><a href={link("/social")}>{demo ? "Vista protegida" : "Veure XXSS"} <span>→</span></a></section>
  </>;
}
