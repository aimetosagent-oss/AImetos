import Link from "next/link";
import { Search } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader } from "@/components";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { requireTenant } from "@/lib/tenant";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const context = await requireTenant();
  const { q: rawQuery } = await searchParams;
  const q = rawQuery?.trim().slice(0, 100) ?? "";
  const [companies, contacts, opportunities, quotes, invoices] = q.length >= 2
    ? await Promise.all([
        db.company.findMany({ where: { organizationId: context.organizationId, deletedAt: null, OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { taxId: { contains: q, mode: "insensitive" } }] }, take: 8, orderBy: { updatedAt: "desc" } }),
        db.contact.findMany({ where: { organizationId: context.organizationId, deletedAt: null, OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }, take: 8, orderBy: { updatedAt: "desc" } }),
        db.opportunity.findMany({ where: { organizationId: context.organizationId, deletedAt: null, title: { contains: q, mode: "insensitive" } }, take: 8, orderBy: { updatedAt: "desc" } }),
        db.quote.findMany({ where: { organizationId: context.organizationId, OR: [{ number: { contains: q, mode: "insensitive" } }, { company: { name: { contains: q, mode: "insensitive" } } }] }, take: 8, orderBy: { updatedAt: "desc" } }),
        db.invoice.findMany({ where: { organizationId: context.organizationId, OR: [{ number: { contains: q, mode: "insensitive" } }, { company: { name: { contains: q, mode: "insensitive" } } }] }, take: 8, orderBy: { updatedAt: "desc" } }),
      ])
    : [[], [], [], [], []] as const;
  const total = companies.length + contacts.length + opportunities.length + quotes.length + invoices.length;
  return (
    <div className="page-stack">
      <PageHeader title="Cerca global" description={q ? `${total} resultats per “${q}”` : "Escriu almenys dos caràcters a la barra de cerca."} />
      {!q || total === 0 ? <Card><CardContent><EmptyState icon={Search} title={q ? "Cap resultat" : "Què vols trobar?"} description={q ? "Prova una altra paraula, correu, empresa o número de document." : "Cerca empreses, contactes, oportunitats, pressupostos i factures."} /></CardContent></Card> : (
        <div className="search-results-grid">
          <ResultGroup title="Empreses" items={companies.map((item) => ({ id: item.id, href: `/companies/${item.id}`, title: item.name, meta: item.email ?? item.taxId ?? "Empresa" }))} />
          <ResultGroup title="Contactes" items={contacts.map((item) => ({ id: item.id, href: `/contacts/${item.id}`, title: `${item.firstName} ${item.lastName ?? ""}`, meta: item.email ?? item.phone ?? "Contacte" }))} />
          <ResultGroup title="Oportunitats" items={opportunities.map((item) => ({ id: item.id, href: "/pipeline", title: item.title, meta: formatMoney(item.valueCents, item.currency) }))} />
          <ResultGroup title="Pressupostos" items={quotes.map((item) => ({ id: item.id, href: `/quotes/${item.id}`, title: item.number, meta: formatMoney(item.totalCents, item.currency), badge: item.status }))} />
          <ResultGroup title="Factures" items={invoices.map((item) => ({ id: item.id, href: `/invoices/${item.id}`, title: item.number, meta: formatMoney(item.remainingAmountCents, item.currency), badge: item.status }))} />
        </div>
      )}
    </div>
  );
}

function ResultGroup({ title, items }: { title: string; items: { id: string; href: string; title: string; meta: string; badge?: string }[] }) {
  if (!items.length) return null;
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="search-result-list">{items.map((item) => <Link key={item.id} href={item.href}><span><strong>{item.title}</strong><small>{item.meta}</small></span>{item.badge ? <Badge tone="blue">{item.badge}</Badge> : null}</Link>)}</CardContent></Card>;
}
