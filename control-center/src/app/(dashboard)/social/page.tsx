import { PageHeader } from "@/components/page-header";
import { SourceStrip } from "@/components/source-strip";
import { getControlCenterData } from "@/lib/data";
import { formatNumber } from "@/lib/format";

export const revalidate = 300;

export default async function SocialPage() {
  const data = await getControlCenterData();
  return <><PageHeader eyebrow="Content Intelligence" title="XXSS" description="La decisió, el millor contingut i què toca produir ara." /><SourceStrip data={data} /><section className="social-hero"><div><span className="eyebrow">Decisió recomanada</span><h2>{data.social.decision}</h2><p>{data.social.winningChannel} és el canal guanyador · {data.social.winningFormat} és el format guanyador.</p></div><div className="social-counts"><span><strong>{data.social.readyToReview}</strong> llest per revisar</span><span><strong>{data.social.draftsNeeded}</strong> necessita esborrany</span></div></section><section className="metric-cards"><div className="metric-card"><span>Leads qualificats</span><strong>{formatNumber(data.social.qualifiedLeads)}</strong></div><div className="metric-card"><span>Reunions</span><strong>{formatNumber(data.social.meetings)}</strong></div></section><section className="panel table-panel"><div className="panel-header"><div><span className="eyebrow">Rendiment</span><h2>Millor contingut</h2></div></div><div className="table-scroll"><table><thead><tr><th>#</th><th>Contingut</th><th>Canal</th><th>Format</th><th>Leads</th><th>Reunions</th><th>Score</th></tr></thead><tbody>{data.social.topContent.map((item) => <tr key={item.rank}><td><span className="rank">{item.rank}</span></td><td><strong>{item.title}</strong></td><td>{item.platform}</td><td>{item.format}</td><td>{item.qualifiedLeads}</td><td>{item.meetings}</td><td>{formatNumber(item.score)}</td></tr>)}</tbody></table></div></section></>;
}
