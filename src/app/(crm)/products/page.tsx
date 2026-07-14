import { Package, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { requireTenant } from "@/lib/tenant";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const { organizationId } = await requireTenant();
  const { created } = await searchParams;
  const products = await db.product.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { quoteItems: true, invoiceItems: true } } },
  });
  const columns: DataTableColumn<(typeof products)[number]>[] = [
    { key: "product", header: "Producte o servei", render: (product) => <div><span className="table-primary">{product.name}</span><span className="table-secondary">{product.sku}</span></div> },
    { key: "type", header: "Facturació", render: (product) => <Badge tone={product.billingType === "RECURRING" ? "blue" : "petrol"}>{product.billingType === "RECURRING" ? "Recurrent" : "Pagament únic"}</Badge> },
    { key: "price", header: "Preu", align: "right", render: (product) => <span className="amount">{formatMoney(product.unitPriceCents, product.currency)}</span> },
    { key: "tax", header: "IVA", align: "right", render: (product) => `${product.taxRateBps / 100}%` },
    { key: "usage", header: "Ús", align: "right", render: (product) => product._count.quoteItems + product._count.invoiceItems },
    { key: "status", header: "Estat", render: (product) => <Badge tone={product.isActive ? "success" : "neutral"} dot>{product.isActive ? "Actiu" : "Inactiu"}</Badge> },
  ];
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Catàleg" title="Productes" description="Serveis reutilitzables en pressupostos i factures, sense dependència de Stripe." actions={<ButtonLink href="/products/new"><Plus size={17} /> Crea producte</ButtonLink>} />
      {created ? <div className="ui-badge ui-badge--success">Producte creat correctament.</div> : null}
      {products.length ? <DataTable caption="Catàleg de productes" columns={columns} rows={products} getRowKey={(product) => product.id} /> : <div className="ui-card"><EmptyState icon={Package} title="El catàleg és buit" description="Crea un producte o servei per reutilitzar-lo als documents comercials." action={<ButtonLink href="/products/new">Crea producte</ButtonLink>} /></div>}
    </div>
  );
}
