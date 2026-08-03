import { ArrowUpRight } from "lucide-react";
import { BarList } from "@/components/bar-list";
import { PageHeader } from "@/components/page-header";
import { SourceStrip } from "@/components/source-strip";
import { getControlCenterData } from "@/lib/data";
import { formatNumber } from "@/lib/format";

export const revalidate = 300;

export default async function LeadsPage({ searchParams }: { searchParams?: Promise<{ source?: string }> }) {
  const params = (await searchParams) || {};
  const data = await getControlCenterData();
  const selectedSource = params.source && ["outbound", "linkedin", "grasshopper"].includes(params.source) ? params.source : "all";
  const sourceName = selectedSource === "all" ? null : selectedSource[0].toUpperCase() + selectedSource.slice(1);
  const bySource = sourceName ? data.leads.bySource.filter((row) => row.label === sourceName) : data.leads.bySource;
  const cards = [["Total unificat", data.leads.total], ["Nous · 7 dies", data.leads.newLast7Days], ["Qualificats", data.leads.qualified], ["Contactats", data.leads.contacted], ["Respostes", data.leads.replies], ["Errors enriquiment", data.leads.enrichmentErrors]] as const;
  return <>
    <PageHeader eyebrow="Pipeline unificat" title="Leads" description="Una lectura general, amb les novetats importants separades per font." />
    <SourceStrip data={data} />
    <div className="filter-row" aria-label="Filtres de leads"><span className="filter-label">Font</span>{[["all", "Tots"], ["outbound", "Outbound"], ["linkedin", "LinkedIn"], ["grasshopper", "Grasshopper"]].map(([value, label]) => <a className={selectedSource === value ? "filter-chip active" : "filter-chip"} href={value === "all" ? "/leads" : `/leads?source=${value}`} key={value}>{label}</a>)}</div>
    <section className="metric-cards">{cards.map(([label, value]) => <div className="metric-card" key={label}><span>{label}</span><strong>{formatNumber(value)}</strong></div>)}</section>
    <section className="panel highlight-panel"><div className="panel-header"><div><span className="eyebrow">Prioritat</span><h2>Novetats importants</h2></div><span className="metric-inline"><strong>{formatNumber(data.leads.newLast7Days)}</strong><span>7 dies</span></span></div><div className="lead-highlights">{data.leads.highlights.length ? data.leads.highlights.map((item) => <a className="lead-highlight" href={item.href || "/leads"} key={`${item.source}-${item.title}`}><div><span className="eyebrow">{item.source}</span><strong>{item.title}</strong><small>{item.detail}</small></div><ArrowUpRight size={17} /></a>) : <p className="empty-state">No hi ha cap novetat prioritària en els últims 7 dies.</p>}</div></section>
    <section className="two-columns"><article className="panel"><div className="panel-header"><div><span className="eyebrow">Distribució</span><h2>Leads per origen</h2></div></div><BarList rows={bySource} /></article><article className="panel"><div className="panel-header"><div><span className="eyebrow">Novetats</span><h2>Nous per origen · 7 dies</h2></div></div><BarList rows={sourceName ? data.leads.recentBySource.filter((row) => row.label === sourceName) : data.leads.recentBySource} /></article></section>
    <section className="panel funnel-panel"><div className="panel-header"><div><span className="eyebrow">Conversió</span><h2>Embut actual</h2></div></div>{[["Capturats", data.leads.total], ["Contactats", data.leads.contacted], ["Qualificats", data.leads.qualified], ["Respostes", data.leads.replies]].map(([label, value], index) => <div className="funnel-step" style={{ width: `${100 - index * 13}%` }} key={label}><span>{label}</span><strong>{formatNumber(Number(value))}</strong></div>)}</section>
  </>;
}
