import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditCard, Download, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { stripeIsConfigured } from "@/lib/env";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

const statusLabel = { DRAFT: "Esborrany", ISSUED: "Emesa", SENT: "Enviada", PARTIALLY_PAID: "Pagada parcialment", PAID: "Pagada", OVERDUE: "Vençuda", CANCELLED: "Cancel·lada" } as const;

export default async function InvoicePublicPage({ params }: { params: Promise<{ publicToken: string }> }) {
  const { publicToken } = await params;
  const invoice = await db.invoice.findUnique({
    where: { publicToken },
    include: { company: true, contact: true, items: { orderBy: { position: "asc" } }, organization: { include: { settings: true } } },
  });
  if (!invoice?.organization.settings || ["DRAFT", "CANCELLED"].includes(invoice.status)) notFound();
  const canPay =
    invoice.organization.settings.stripeEnabled &&
    invoice.organization.settings.stripeTestMode &&
    stripeIsConfigured() &&
    ["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) &&
    invoice.remainingAmountCents > 0;
  return (
    <main className="document-public-shell">
      <section className="document-public-card">
        <header className="document-public-header">
          <Image src="/brand/logo-web.png" alt="AImetos" width={189} height={62} priority />
          <div>
            <span className={`document-status status-${invoice.status.toLowerCase()}`}>{statusLabel[invoice.status]}</span>
            <p>Factura</p>
            <h1>{invoice.number}</h1>
          </div>
        </header>
        <div className="document-meta-grid">
          <div><span>Emissor</span><strong>{invoice.organization.settings.tradeName}</strong><p>{invoice.organization.settings.legalName}</p><p>{invoice.organization.settings.taxId}</p></div>
          <div><span>Client</span><strong>{invoice.company.name}</strong><p>{invoice.contact ? `${invoice.contact.firstName} ${invoice.contact.lastName ?? ""}` : invoice.company.email}</p><p>{invoice.company.taxId}</p></div>
          <div><span>Data d’emissió</span><strong>{invoice.issueDate.toLocaleDateString("ca-ES")}</strong></div>
          <div><span>Venciment</span><strong>{invoice.dueDate.toLocaleDateString("ca-ES")}</strong></div>
        </div>
        <div className="document-table-wrap" role="region" aria-label="Línies de la factura" tabIndex={0}><table className="document-table"><caption className="sr-only">Línies de la factura {invoice.number}</caption><thead><tr><th>Descripció</th><th>Quantitat</th><th>Preu</th><th>IVA</th><th>Total</th></tr></thead><tbody>{invoice.items.map((item) => <tr key={item.id}><td>{item.description}</td><td>{item.quantity}</td><td>{formatMoney(item.unitPriceCents, invoice.currency)}</td><td>{item.taxRateBps / 100}%</td><td>{formatMoney(item.totalCents, invoice.currency)}</td></tr>)}</tbody></table></div>
        <div className="document-summary"><dl><div><dt>Subtotal</dt><dd>{formatMoney(invoice.subtotalCents, invoice.currency)}</dd></div><div><dt>Impostos</dt><dd>{formatMoney(invoice.taxAmountCents, invoice.currency)}</dd></div><div className="document-total"><dt>Total</dt><dd>{formatMoney(invoice.totalCents, invoice.currency)}</dd></div><div><dt>Pagat</dt><dd>{formatMoney(invoice.paidAmountCents, invoice.currency)}</dd></div><div className="document-pending"><dt>Pendent</dt><dd>{formatMoney(invoice.remainingAmountCents, invoice.currency)}</dd></div></dl></div>
        {invoice.notesText || invoice.terms ? <div className="document-copy-grid">{invoice.notesText ? <div><h2>Notes</h2><p>{invoice.notesText}</p></div> : null}{invoice.terms ? <div><h2>Condicions</h2><p>{invoice.terms}</p></div> : null}</div> : null}
        <footer className="document-actions">
          <Link className="button button-secondary" href={`/i/${publicToken}/pdf`} target="_blank"><Download size={17} /> Descarregar PDF</Link>
          {invoice.status === "PAID" ? <div className="document-confirmation"><ShieldCheck size={20} /> Factura pagada</div> : canPay ? <form action={`/api/invoices/${invoice.id}/checkout`} method="post"><input type="hidden" name="publicToken" value={publicToken} /><button className="button button-primary" type="submit"><CreditCard size={17} /> Pagar amb Stripe</button></form> : <p className="document-payment-note">El pagament en línia no està configurat. Contacta amb AImetos per completar el pagament.</p>}
        </footer>
      </section>
      <p className="public-footer">Aquest CRM gestiona el procés comercial; aquesta factura no es presenta com una implementació completa de VeriFactu.</p>
    </main>
  );
}
