import { CircleAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SourceStrip } from "@/components/source-strip";
import { getControlCenterData } from "@/lib/data";
import { formatCurrency } from "@/lib/format";

export const revalidate = 300;

export default async function FinancesPage() {
  const data = await getControlCenterData();
  const rows = [["Caixa real", data.finance.cashReal, "Moviments cobrats i pagats"], ["Caixa prevista", data.finance.cashForecast, "Real + moviments previstos"], ["Resultat del trimestre", data.finance.quarterResult, data.finance.quarterLabel], ["Estimació fiscal", data.finance.taxEstimate, "IVA i IRPF aproximats"], ["Ingressos pendents", data.finance.pendingIncome, "Per cobrar"], ["Despeses pendents", data.finance.pendingExpenses, "Per pagar"]] as const;
  return <><PageHeader eyebrow="Control financer" title="Finances" description="Caixa, trimestre i obligacions aproximades, sense substituir la revisió fiscal." /><SourceStrip data={data} />{!data.finance.nativeSheetReady ? <div className="notice"><CircleAlert size={18} /><div><strong>Còpia nativa pendent</strong><p>L’Excel original queda intacte. Configura el nou Google Sheet a FINANCE_SHEET_ID per activar dades reals.</p></div></div> : null}<section className="finance-grid">{rows.map(([label, value, detail]) => <article className="finance-card" key={label}><span>{label}</span><strong>{formatCurrency(value)}</strong><small>{detail}</small></article>)}</section><section className="decision-card finance-decision"><div><span className="eyebrow">Lectura del trimestre</span><h2>{data.finance.taxEstimate !== null && data.finance.taxEstimate > 0 ? "Reserva caixa per a les obligacions fiscals" : "Revisa el trimestre abans del tancament"}</h2><p>La data límit es manté com a configuració operativa; no es dedueix automàticament.</p></div></section></>;
}
