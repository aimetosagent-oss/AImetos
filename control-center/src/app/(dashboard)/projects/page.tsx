import { Clock3, LockKeyhole } from "lucide-react";
import { BarList } from "@/components/bar-list";
import { PageHeader } from "@/components/page-header";
import { SourceStrip } from "@/components/source-strip";
import { getControlCenterData } from "@/lib/data";
import { formatNumber } from "@/lib/format";

export const revalidate = 300;

export default async function ProjectsPage() {
  const data = await getControlCenterData();
  return <><PageHeader eyebrow="CCPM + Clockify" title="Projectes" description="Què està actiu, què s’ha acabat, què bloqueja i on s’estan invertint les hores." /><SourceStrip data={data} /><section className="metric-cards project-metrics"><div className="metric-card"><span>Actius</span><strong>{formatNumber(data.projects.active)}</strong></div><div className="metric-card"><span>Finalitzats · setmana anterior</span><strong>{formatNumber(data.projects.completedPreviousWeek)}</strong>{data.projects.completedMetricNote ? <small>{data.projects.completedMetricNote}</small> : null}</div><div className="metric-card"><span>Bloquejats</span><strong>{formatNumber(data.projects.blocked)}</strong></div><div className="metric-card"><span>Hores · 31 dies</span><strong>{formatNumber(data.projects.hours31Days)} h</strong></div></section><section className="two-columns projects-layout"><article className="panel"><div className="panel-header"><div><span className="eyebrow">Clockify</span><h2>Hores per projecte</h2></div><Clock3 size={19} /></div><BarList rows={data.projects.hoursByProject.slice(0, 8)} valueSuffix=" h" /></article><article className="panel"><div className="panel-header"><div><span className="eyebrow">Focus</span><h2>Projectes actius</h2></div></div><div className="project-list">{data.projects.projects.map((project) => <div className="project-item" key={project.id}><div className="project-top"><div><strong>{project.name}</strong><small>{project.nextAction || "Sense pròxima acció"}</small></div>{project.blocked ? <span className="blocked-label"><LockKeyhole size={13} /> Bloquejat</span> : <span className="progress-label">{Math.round(project.progress)}%</span>}</div><div className="progress-track"><span style={{ width: `${Math.min(Math.max(project.progress, 0), 100)}%` }} /></div></div>)}</div></article></section></>;
}
