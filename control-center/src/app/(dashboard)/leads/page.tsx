import { BarList } from "@/components/bar-list";
import { PageHeader } from "@/components/page-header";
import { SourceStrip } from "@/components/source-strip";
import { getControlCenterData } from "@/lib/data";
import { formatNumber } from "@/lib/format";

export const revalidate = 300;

export default async function LeadsPage() {
  const data = await getControlCenterData();
  const cards = [["Total unificat", data.leads.total], ["Nous · 7 dies", data.leads.newLast7Days], ["Qualificats", data.leads.qualified], ["Contactats", data.leads.contacted], ["Respostes", data.leads.replies], ["Errors enriquiment", data.leads.enrichmentErrors]] as const;
  return <><PageHeader eyebrow="Pipeline unificat" title="Leads" description="Una sola lectura comercial, amb l’origen sempre disponible com a filtre." /><SourceStrip data={data} /><section className="metric-cards">{cards.map(([label, value]) => <div className="metric-card" key={label}><span>{label}</span><strong>{formatNumber(value)}</strong></div>)}</section><section className="two-columns"><article className="panel"><div className="panel-header"><div><span className="eyebrow">Distribució</span><h2>Leads per origen</h2></div></div><BarList rows={data.leads.bySource} /></article><article className="panel funnel-panel"><div className="panel-header"><div><span className="eyebrow">Conversió</span><h2>Embut actual</h2></div></div>{[["Capturats", data.leads.total], ["Contactats", data.leads.contacted], ["Qualificats", data.leads.qualified], ["Respostes", data.leads.replies]].map(([label, value], index) => <div className="funnel-step" style={{ width: `${100 - index * 13}%` }} key={label}><span>{label}</span><strong>{formatNumber(Number(value))}</strong></div>)}</article></section></>;
}
