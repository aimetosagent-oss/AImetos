import Link from "next/link";
import { ContactRound, Plus, Search } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { organizationId } = await requireTenant();
  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 100);
  const contacts = await db.contact.findMany({
    where: {
      organizationId,
      deletedAt: null,
      ...(query
        ? {
            OR: [
              { firstName: { contains: query, mode: "insensitive" as const } },
              { lastName: { contains: query, mode: "insensitive" as const } },
              { email: { contains: query, mode: "insensitive" as const } },
              { phone: { contains: query, mode: "insensitive" as const } },
              { company: { name: { contains: query, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      company: { select: { id: true, name: true } },
      owner: { select: { name: true } },
      _count: { select: { opportunities: true, tasks: true } },
    },
  });
  const columns: DataTableColumn<(typeof contacts)[number]>[] = [
    {
      key: "name",
      header: "Contacte",
      render: (contact) => (
        <div>
          <Link className="table-primary link-inline" href={`/contacts/${contact.id}`}>
            {[contact.firstName, contact.lastName].filter(Boolean).join(" ")}
          </Link>
          <span className="table-secondary">{contact.position || "Sense càrrec"}</span>
        </div>
      ),
    },
    {
      key: "company",
      header: "Empresa",
      render: (contact) => contact.company ? <Link className="link-inline" href={`/companies/${contact.company.id}`}>{contact.company.name}</Link> : "—",
    },
    { key: "email", header: "Correu", render: (contact) => contact.email || "—" },
    { key: "phone", header: "Telèfon", render: (contact) => contact.phone || "—" },
    { key: "opportunities", header: "Oportunitats", align: "right", render: (contact) => contact._count.opportunities },
    { key: "owner", header: "Responsable", render: (contact) => contact.owner?.name || "—" },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CRM"
        title="Contactes"
        description="Persones, empreses relacionades i context comercial compartit."
        actions={<ButtonLink href="/contacts/new"><Plus size={17} /> Crea contacte</ButtonLink>}
      />
      <form className="toolbar" action="/contacts">
        <SearchInput name="q" defaultValue={query} placeholder="Cerca per nom, empresa, correu…" aria-label="Cerca contactes" />
        {query ? <ButtonLink href="/contacts" variant="ghost">Neteja la cerca</ButtonLink> : null}
      </form>
      {contacts.length ? (
        <DataTable caption="Llista de contactes" columns={columns} rows={contacts} getRowKey={(contact) => contact.id} />
      ) : (
        <div className="ui-card">
          <EmptyState
            icon={query ? Search : ContactRound}
            title={query ? "No hi ha coincidències" : "Encara no hi ha contactes"}
            description={query ? "Prova una cerca diferent." : "Crea el primer contacte per començar el seguiment comercial."}
            action={!query ? <ButtonLink href="/contacts/new">Crea contacte</ButtonLink> : undefined}
          />
        </div>
      )}
    </div>
  );
}
