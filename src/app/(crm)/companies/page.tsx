import Link from "next/link";
import { Building2, Plus, Search } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { organizationId } = await requireTenant();
  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 100);
  const companies = await db.company.findMany({
    where: {
      organizationId,
      deletedAt: null,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { legalName: { contains: query, mode: "insensitive" as const } },
              { email: { contains: query, mode: "insensitive" as const } },
              { taxId: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { contacts: true, opportunities: true, tasks: true } } },
  });

  const columns: DataTableColumn<(typeof companies)[number]>[] = [
    {
      key: "name",
      header: "Empresa",
      render: (company) => (
        <div>
          <Link className="table-primary link-inline" href={`/companies/${company.id}`}>{company.name}</Link>
          <span className="table-secondary">{company.legalName || company.sector || "Sense dades addicionals"}</span>
        </div>
      ),
    },
    { key: "contact", header: "Contacte", render: (company) => <div>{company.email || "—"}<span className="table-secondary">{company.phone || ""}</span></div> },
    { key: "city", header: "Ubicació", render: (company) => [company.city, company.country].filter(Boolean).join(", ") || "—" },
    { key: "contacts", header: "Contactes", align: "right", render: (company) => company._count.contacts },
    { key: "opportunities", header: "Oportunitats", align: "right", render: (company) => company._count.opportunities },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CRM"
        title="Empreses"
        description="Organitzacions comercials, contactes associats i historial d’activitat."
        actions={<ButtonLink href="/companies/new"><Plus size={17} /> Crea empresa</ButtonLink>}
      />
      <form className="toolbar" action="/companies">
        <SearchInput name="q" defaultValue={query} placeholder="Cerca per nom, NIF o correu…" aria-label="Cerca empreses" />
        {query ? <ButtonLink href="/companies" variant="ghost">Neteja la cerca</ButtonLink> : null}
      </form>
      {companies.length ? (
        <DataTable caption="Llista d’empreses" columns={columns} rows={companies} getRowKey={(company) => company.id} />
      ) : (
        <div className="ui-card">
          <EmptyState
            icon={query ? Search : Building2}
            title={query ? "No hi ha coincidències" : "Encara no hi ha empreses"}
            description={query ? "Prova una cerca diferent." : "Crea la primera empresa per començar a centralitzar la relació comercial."}
            action={!query ? <ButtonLink href="/companies/new">Crea empresa</ButtonLink> : undefined}
          />
        </div>
      )}
    </div>
  );
}
