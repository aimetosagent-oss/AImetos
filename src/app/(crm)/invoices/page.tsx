import Link from "next/link";
import { Plus, ReceiptText } from "lucide-react";
import { Badge, ButtonLink, DataTable, EmptyState, PageHeader, StatusBadge } from "@/components";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { requireTenant } from "@/lib/tenant";

const labels: Record<string, string> = { DRAFT: "Esborrany", ISSUED: "Emesa", SENT: "Enviada", PARTIALLY_PAID: "Pagada parcialment", PAID: "Pagada", OVERDUE: "Vençuda", CANCELLED: "Cancel·lada" };

export default async function InvoicesPage() {
  const context = await requireTenant();
  const invoices = await db.invoice.findMany({ where: { organizationId: context.organizationId }, include: { company: true }, orderBy: { createdAt: "desc" } });
  return (
    <div className="page-stack">
      <PageHeader title="Factures" description="Emissió, venciments, pagaments parcials i saldo pendent." actions={<ButtonLink href="/invoices/new"><Plus size={17} /> Nova factura</ButtonLink>} />
      <DataTable
        caption="Llista de factures"
        rows={invoices}
        getRowKey={(invoice) => invoice.id}
        empty={<EmptyState compact icon={ReceiptText} title="Encara no hi ha factures" description="Crea’n una manualment o converteix un pressupost acceptat." action={<ButtonLink href="/invoices/new" size="sm">Crear factura</ButtonLink>} />}
        columns={[
          { key: "number", header: "Número", render: (invoice) => <Link className="table-primary-link" href={`/invoices/${invoice.id}`}>{invoice.number}</Link> },
          { key: "company", header: "Empresa", render: (invoice) => invoice.company.name },
          { key: "status", header: "Estat", render: (invoice) => <StatusBadge status={invoice.status} label={labels[invoice.status]} /> },
          { key: "due", header: "Venciment", render: (invoice) => invoice.dueDate.toLocaleDateString("ca-ES") },
          { key: "total", header: "Total", align: "right", render: (invoice) => formatMoney(invoice.totalCents, invoice.currency) },
          { key: "remaining", header: "Pendent", align: "right", render: (invoice) => <strong>{formatMoney(invoice.remainingAmountCents, invoice.currency)}</strong> },
          { key: "public", header: "Enllaç", align: "right", render: (invoice) => invoice.status !== "DRAFT" ? <Link href={`/i/${invoice.publicToken}`} target="_blank"><Badge tone="blue">Obrir</Badge></Link> : "—" },
        ]}
      />
    </div>
  );
}
