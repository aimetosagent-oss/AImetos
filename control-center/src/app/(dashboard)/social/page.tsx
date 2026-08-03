import { ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SourceStrip } from "@/components/source-strip";
import { getControlCenterData } from "@/lib/data";
import { formatNumber } from "@/lib/format";

export const revalidate = 300;

export default async function SocialPage() {
  const data = await getControlCenterData();
  const socialDashboardUrl = process.env.SOCIAL_DASHBOARD_URL || "https://dashboard.aimetos.com/";
  return <>
    <PageHeader eyebrow="Content Intelligence" title="XXSS" description="Un resum mínim aquí; el detall viu al dashboard específic de xarxes socials." />
    <SourceStrip data={data} />
    <section className="social-hero"><div><span className="eyebrow">Decisió recomanada</span><h2>{data.social.decision}</h2><p>{data.social.winningChannel} és el canal guanyador · {data.social.winningFormat} és el format guanyador.</p></div><a className="external-link" href={socialDashboardUrl} target="_blank" rel="noreferrer">Obrir dashboard XXSS <ArrowUpRight size={16} /></a></section>
    <section className="metric-cards"><div className="metric-card"><span>Llest per revisar</span><strong>{formatNumber(data.social.readyToReview)}</strong></div><div className="metric-card"><span>Necessita esborrany</span><strong>{formatNumber(data.social.draftsNeeded)}</strong></div><div className="metric-card"><span>Leads qualificats</span><strong>{formatNumber(data.social.qualifiedLeads)}</strong></div><div className="metric-card"><span>Reunions</span><strong>{formatNumber(data.social.meetings)}</strong></div></section>
    <section className="panel social-summary"><div className="panel-header"><div><span className="eyebrow">Lectura ràpida</span><h2>El detall i les publicacions</h2></div></div><p>Per veure el calendari, el millor contingut i els informes complets, obre el dashboard específic de XXSS.</p><a className="text-link" href={socialDashboardUrl} target="_blank" rel="noreferrer">Anar al dashboard de XXSS <ArrowUpRight size={15} /></a></section>
  </>;
}
