import { notFound } from "next/navigation";
import { Copy, Download, ExternalLink, FileCheck2, Mail, ReceiptText } from "lucide-react";
import { Badge, Button, ButtonLink, Card, CardContent, CardHeader, CardTitle, PageHeader, StatusBadge } from "@/components";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { requireTenant } from "@/lib/tenant";
import { convertQuoteAction, duplicateQuoteAction, sendQuoteAction } from "../../document-actions";

const labels: Record<string, string> = { DRAFT: "Esborrany", SENT: "Enviat", VIEWED: "Vist", ACCEPTED: "Acceptat", REJECTED: "Rebutjat", EXPIRED: "Caducat", CANCELLED: "Cancel·lat" };

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireTenant();
  const { id } = await params;
  const quote = await db.quote.findFirst({
    where: { id, organizationId: context.organizationId },
    include: { company: true, contact: true, opportunity: true, items: { orderBy: { position: "asc" } }, invoice: true, scheduledJobs: { orderBy: { runAt: "asc" } } },
  });
  if (!quote) notFound();
  return (
    <div className="page-stack">
      <PageHeader
        title={quote.number}
        description={`${quote.company.name} · ${formatMoney(quote.totalCents, quote.currency)}`}
        breadcrumbs={[{ label: "Pressupostos", href: "/quotes" }, { label: quote.number }]}
        actions={<><StatusBadge status={quote.status} label={labels[quote.status]} />{quote.status !== "DRAFT" ? <ButtonLink href={`/q/${quote.publicToken}`} target="_blank" variant="outline"><ExternalLink size={16} /> Enllaç públic</ButtonLink> : null}</>}
      />
      <div className="content-grid">
        <Card className="span-8">
          <CardHeader><CardTitle>Detall del pressupost</CardTitle></CardHeader>
          <CardContent>
            <div className="detail-facts"><div><span>Client</span><strong>{quote.company.name}</strong><small>{quote.contact ? `${quote.contact.firstName} ${quote.contact.lastName ?? ""}` : "Sense contacte"}</small></div><div><span>Emissió</span><strong>{quote.issueDate.toLocaleDateString("ca-ES")}</strong></div><div><span>Validesa</span><strong>{quote.validUntil.toLocaleDateString("ca-ES")}</strong></div><div><span>Oportunitat</span><strong>{quote.opportunity?.title ?? "Sense oportunitat"}</strong></div></div>
            <div className="document-table-wrap" role="region" aria-label="Línies del pressupost" tabIndex={0}><table className="document-table"><caption className="sr-only">Línies del pressupost {quote.number}</caption><thead><tr><th>Descripció</th><th>Qtat.</th><th>Preu</th><th>IVA</th><th>Total</th></tr></thead><tbody>{quote.items.map((item) => <tr key={item.id}><td>{item.description}</td><td>{item.quantity}</td><td>{formatMoney(item.unitPriceCents, quote.currency)}</td><td>{item.taxRateBps / 100}%</td><td><strong>{formatMoney(item.totalCents, quote.currency)}</strong></td></tr>)}</tbody></table></div>
            <div className="document-summary"><dl><div><dt>Subtotal</dt><dd>{formatMoney(quote.subtotalCents, quote.currency)}</dd></div><div><dt>Impostos</dt><dd>{formatMoney(quote.taxAmountCents, quote.currency)}</dd></div><div className="document-total"><dt>Total</dt><dd>{formatMoney(quote.totalCents, quote.currency)}</dd></div></dl></div>
            {quote.decisionComment ? <div className="inline-note"><strong>Comentari del client</strong><p>{quote.decisionComment}</p></div> : null}
          </CardContent>
        </Card>
        <div className="span-4 side-stack">
          <Card><CardHeader><CardTitle>Accions</CardTitle></CardHeader><CardContent className="action-stack">
            {quote.status === "DRAFT" ? <form action={sendQuoteAction}><input type="hidden" name="id" value={quote.id} /><Button type="submit"><Mail size={16} /> Enviar per correu</Button></form> : null}
            {quote.status !== "DRAFT" ? <ButtonLink href={`/q/${quote.publicToken}/pdf`} target="_blank" variant="outline"><Download size={16} /> Veure PDF</ButtonLink> : null}
            <form action={duplicateQuoteAction}><input type="hidden" name="id" value={quote.id} /><Button type="submit" variant="outline"><Copy size={16} /> Duplicar</Button></form>
            {quote.status === "ACCEPTED" && !quote.invoice ? <form action={convertQuoteAction}><input type="hidden" name="id" value={quote.id} /><Button type="submit"><ReceiptText size={16} /> Convertir en factura</Button></form> : null}
            {quote.invoice ? <ButtonLink href={`/invoices/${quote.invoice.id}`} variant="secondary"><FileCheck2 size={16} /> Obrir factura {quote.invoice.number}</ButtonLink> : null}
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Seguiments</CardTitle></CardHeader><CardContent className="timeline-list">{quote.scheduledJobs.length ? quote.scheduledJobs.map((job) => <div key={job.id}><Badge tone={job.status === "COMPLETED" ? "success" : job.status === "CANCELLED" ? "neutral" : "blue"}>{job.status}</Badge><span>{job.type.replaceAll("_", " ")}</span><small>{job.runAt.toLocaleString("ca-ES")}</small></div>) : <p>No hi ha seguiments programats.</p>}</CardContent></Card>
        </div>
      </div>
    </div>
  );
}
