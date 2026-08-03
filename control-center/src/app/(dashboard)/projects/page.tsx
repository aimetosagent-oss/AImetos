import { Clock3, LockKeyhole } from "lucide-react";
import { BarList } from "@/components/bar-list";
import { PageHeader } from "@/components/page-header";
import { SourceStrip } from "@/components/source-strip";
import { getControlCenterData } from "@/lib/data";
import type { ClockifyPeriod } from "@/lib/integrations/clockify";
import { formatNumber } from "@/lib/format";

export const revalidate = 300;

const periods: Array<{ value: ClockifyPeriod; label: string }> = [
  { value: "7d", label: "Aquesta setmana" },
  { value: "31d", label: "Últims 31 dies" },
  { value: "month", label: "Aquest mes" },
  { value: "previous-month", label: "Mes anterior" },
];

export default async function ProjectsPage({ searchParams }: { searchParams?: Promise<{ period?: string; status?: string; project?: string }> }) {
  const params = (await searchParams) || {};
  const period = periods.some((item) => item.value === params.period) ? params.period as ClockifyPeriod : "31d";
  const status = params.status === "blocked" ? "blocked" : "active";
  const data = await getControlCenterData({ clockifyPeriod: period });
  const projects = data.projects.projects.filter((project) => status === "blocked" ? project.blocked : !project.blocked);
  const hours = params.project ? data.projects.hoursByProject.filter((row) => row.label === params.project) : data.projects.hoursByProject;
  const query = (extra: Record<string, string>) => {
    const next = new URLSearchParams();
    next.set("period", period);
    Object.entries(extra).forEach(([key, value]) => next.set(key, value));
    return `/projects?${next.toString()}`;
  };
  return <>
    <PageHeader eyebrow="CCPM + Clockify" title="Projectes" description="Actius, bloquejats, finalitzats i hores invertides, sense soroll." />
    <SourceStrip data={data} />
    <div className="filter-row" aria-label="Filtres de projectes">
      <span className="filter-label">Projectes</span>
      <a className={status === "active" ? "filter-chip active" : "filter-chip"} href={query({ status: "active" })}>Actius</a>
      <a className={status === "blocked" ? "filter-chip active" : "filter-chip"} href={query({ status: "blocked" })}>Bloquejats ({formatNumber(data.projects.blocked)})</a>
      <span className="filter-label clockify-filter-label">Clockify</span>
      {periods.map((item) => <a className={period === item.value ? "filter-chip active" : "filter-chip"} href={query({ status, period: item.value })} key={item.value}>{item.label}</a>)}
    </div>
    <section className="metric-cards project-metrics">
      <div className="metric-card"><span>Actius</span><strong>{formatNumber(data.projects.active)}</strong></div>
      <div className="metric-card"><span>Finalitzats</span><strong>{formatNumber(data.projects.completedTotal)}</strong>{data.projects.completedMetricNote ? <small>{data.projects.completedMetricNote}</small> : <small>Comparativa setmanal pendent de la data de finalització.</small>}</div>
      <div className="metric-card"><span>Bloquejats</span><strong>{formatNumber(data.projects.blocked)}</strong></div>
      <div className="metric-card"><span>Hores · {period === "7d" ? "7 dies" : period === "month" ? "mes actual" : period === "previous-month" ? "mes anterior" : "31 dies"}</span><strong>{formatNumber(data.projects.hours31Days)} h</strong></div>
    </section>
    <section className="two-columns projects-layout">
      <article className="panel"><div className="panel-header"><div><span className="eyebrow">Clockify</span><h2>Hores per projecte</h2></div><Clock3 size={19} /></div><BarList rows={hours.slice(0, 12)} valueSuffix=" h" /></article>
      <article className="panel"><div className="panel-header"><div><span className="eyebrow">Focus</span><h2>{status === "blocked" ? "Projectes bloquejats" : "Projectes actius"}</h2></div></div><div className="project-list">{projects.map((project) => <div className="project-item" key={project.id}><div className="project-top"><div><strong>{project.name}</strong><small>{project.nextAction || "Sense pròxima acció"}</small></div>{project.blocked ? <span className="blocked-label"><LockKeyhole size={13} /> Bloquejat</span> : null}</div></div>)}</div>{projects.length === 0 ? <p className="empty-state">No hi ha projectes en aquest filtre.</p> : null}</article>
    </section>
  </>;
}
