import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Badge, ButtonLink, DataTable, EmptyState, PageHeader, StatusBadge } from "@/components";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { requireTenant } from "@/lib/tenant";

const labels: Record<string, string> = { DRAFT: "Esborrany", SENT: "Enviat", VIEWED: "Vist", ACCEPTED: "Acceptat", REJECTED: "Rebutjat", EXPIRED: "Caducat", CANCELLED: "Cancel·lat" };

export default async function QuotesPage() {
  const context = await requireTenant();
  const quotes = await db.quote.findMany({
    where: { organizationId: context.organizationId },
    include: { company: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="page-stack">
      <PageHeader title="Pressupostos" description="Propostes comercials, seguiments i acceptacions en un sol lloc." actions={<ButtonLink href="/quotes/new"><Plus size={17} /> Nou pressupost</ButtonLink>} />
      <DataTable
        caption="Llista de pressupostos"
        rows={quotes}
        getRowKey={(quote) => quote.id}
        empty={<EmptyState compact icon={FileText} title="Encara no hi ha pressupostos" description="Crea la primera proposta comercial." action={<ButtonLink href="/quotes/new" size="sm">Crear pressupost</ButtonLink>} />}
        columns={[
          { key: "number", header: "Número", render: (quote) => <Link className="table-primary-link" href={`/quotes/${quote.id}`}>{quote.number}</Link> },
          { key: "company", header: "Empresa", render: (quote) => quote.company.name },
          { key: "status", header: "Estat", render: (quote) => <StatusBadge status={quote.status} label={labels[quote.status]} /> },
          { key: "valid", header: "Validesa", render: (quote) => quote.validUntil.toLocaleDateString("ca-ES") },
          { key: "total", header: "Total", align: "right", render: (quote) => <strong>{formatMoney(quote.totalCents, quote.currency)}</strong> },
          { key: "public", header: "Enllaç", align: "right", render: (quote) => quote.status !== "DRAFT" ? <Link href={`/q/${quote.publicToken}`} target="_blank"><Badge tone="blue">Obrir</Badge></Link> : "—" },
        ]}
      />
    </div>
  );
}
