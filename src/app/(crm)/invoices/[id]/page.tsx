import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { CreditCard, Download, ExternalLink, Mail } from "lucide-react";
import { Badge, Button, ButtonLink, Card, CardContent, CardHeader, CardTitle, Field, Input, PageHeader, StatusBadge } from "@/components";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { requireTenant } from "@/lib/tenant";
import { manualPaymentAction, sendInvoiceAction } from "../../document-actions";

const labels: Record<string, string> = { DRAFT: "Esborrany", ISSUED: "Emesa", SENT: "Enviada", PARTIALLY_PAID: "Pagada parcialment", PAID: "Pagada", OVERDUE: "Vençuda", CANCELLED: "Cancel·lada" };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireTenant();
  const { id } = await params;
  const invoice = await db.invoice.findFirst({
    where: { id, organizationId: context.organizationId },
    include: { company: true, contact: true, opportunity: true, quote: true, items: { orderBy: { position: "asc" } }, payments: { orderBy: { receivedAt: "desc" } }, scheduledJobs: { orderBy: { runAt: "asc" } } },
  });
  if (!invoice) notFound();
  return (
    <div className="page-stack">
      <PageHeader title={invoice.number} description={`${invoice.company.name} · ${formatMoney(invoice.totalCents, invoice.currency)}`} breadcrumbs={[{ label: "Factures", href: "/invoices" }, { label: invoice.number }]} actions={<><StatusBadge status={invoice.status} label={labels[invoice.status]} />{invoice.status !== "DRAFT" ? <ButtonLink href={`/i/${invoice.publicToken}`} target="_blank" variant="outline"><ExternalLink size={16} /> Enllaç públic</ButtonLink> : null}</>} />
      <div className="content-grid">
        <Card className="span-8"><CardHeader><CardTitle>Detall de la factura</CardTitle></CardHeader><CardContent>
          <div className="detail-facts"><div><span>Client</span><strong>{invoice.company.name}</strong><small>{invoice.contact ? `${invoice.contact.firstName} ${invoice.contact.lastName ?? ""}` : "Sense contacte"}</small></div><div><span>Emissió</span><strong>{invoice.issueDate.toLocaleDateString("ca-ES")}</strong></div><div><span>Venciment</span><strong>{invoice.dueDate.toLocaleDateString("ca-ES")}</strong></div><div><span>Origen</span><strong>{invoice.quote ? `Pressupost ${invoice.quote.number}` : "Factura manual"}</strong></div></div>
          <div className="document-table-wrap" role="region" aria-label="Línies de la factura" tabIndex={0}><table className="document-table"><caption className="sr-only">Línies de la factura {invoice.number}</caption><thead><tr><th>Descripció</th><th>Qtat.</th><th>Preu</th><th>IVA</th><th>Total</th></tr></thead><tbody>{invoice.items.map((item) => <tr key={item.id}><td>{item.description}</td><td>{item.quantity}</td><td>{formatMoney(item.unitPriceCents, invoice.currency)}</td><td>{item.taxRateBps / 100}%</td><td><strong>{formatMoney(item.totalCents, invoice.currency)}</strong></td></tr>)}</tbody></table></div>
          <div className="document-summary"><dl><div><dt>Subtotal</dt><dd>{formatMoney(invoice.subtotalCents, invoice.currency)}</dd></div><div><dt>Impostos</dt><dd>{formatMoney(invoice.taxAmountCents, invoice.currency)}</dd></div><div className="document-total"><dt>Total</dt><dd>{formatMoney(invoice.totalCents, invoice.currency)}</dd></div><div><dt>Pagat</dt><dd>{formatMoney(invoice.paidAmountCents, invoice.currency)}</dd></div><div className="document-pending"><dt>Pendent</dt><dd>{formatMoney(invoice.remainingAmountCents, invoice.currency)}</dd></div></dl></div>
        </CardContent></Card>
        <div className="span-4 side-stack">
          <Card><CardHeader><CardTitle>Accions</CardTitle></CardHeader><CardContent className="action-stack">
            {["DRAFT", "ISSUED"].includes(invoice.status) ? <form action={sendInvoiceAction}><input type="hidden" name="id" value={invoice.id} /><Button type="submit"><Mail size={16} /> Emetre i enviar</Button></form> : null}
            {invoice.status !== "DRAFT" ? <ButtonLink href={`/i/${invoice.publicToken}/pdf`} target="_blank" variant="outline"><Download size={16} /> Veure PDF</ButtonLink> : null}
            {!["DRAFT", "PAID", "CANCELLED"].includes(invoice.status) && invoice.remainingAmountCents > 0 ? <form action={manualPaymentAction} className="compact-form"><input type="hidden" name="id" value={invoice.id} /><input type="hidden" name="idempotencyKey" value={randomUUID()} /><Field label="Registrar pagament manual" htmlFor="amount" hint={`Màxim ${formatMoney(invoice.remainingAmountCents, invoice.currency)}`}><Input id="amount" name="amount" inputMode="decimal" defaultValue={(invoice.remainingAmountCents / 100).toFixed(2)} required /></Field><Field label="Referència o nota" htmlFor="payment-note"><Input id="payment-note" name="note" placeholder="Opcional" /></Field><Button type="submit"><CreditCard size={16} /> Registrar pagament</Button></form> : null}
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Pagaments</CardTitle></CardHeader><CardContent className="timeline-list">{invoice.payments.length ? invoice.payments.map((payment) => <div key={payment.id}><Badge tone={payment.status === "SUCCEEDED" ? "success" : "warning"}>{payment.method}</Badge><span>{formatMoney(payment.amountCents, payment.currency)}</span><small>{payment.receivedAt?.toLocaleString("ca-ES")}</small></div>) : <p>Encara no s’ha registrat cap pagament.</p>}</CardContent></Card>
          <Card><CardHeader><CardTitle>Recordatoris</CardTitle></CardHeader><CardContent className="timeline-list">{invoice.scheduledJobs.length ? invoice.scheduledJobs.filter((job) => job.type.includes("INVOICE")).map((job) => <div key={job.id}><Badge tone={job.status === "COMPLETED" ? "success" : job.status === "CANCELLED" ? "neutral" : "blue"}>{job.status}</Badge><span>{job.type.replaceAll("_", " ")}</span><small>{job.runAt.toLocaleString("ca-ES")}</small></div>) : <p>No hi ha recordatoris programats.</p>}</CardContent></Card>
        </div>
      </div>
    </div>
  );
}
