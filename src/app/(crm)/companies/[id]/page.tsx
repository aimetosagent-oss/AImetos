import Link from "next/link";
import { BriefcaseBusiness, CheckSquare2, ContactRound, FileText, MessageSquareText } from "lucide-react";
import { notFound } from "next/navigation";

import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FormActions, Textarea } from "@/components/ui/form";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { requireTenant } from "@/lib/tenant";

import { addNoteAction } from "../../actions";

const dateFormatter = new Intl.DateTimeFormat("ca-ES", { dateStyle: "medium", timeStyle: "short" });

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { organizationId } = await requireTenant();
  const { id } = await params;
  const company = await db.company.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: {
      contacts: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 10 },
      opportunities: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, include: { stage: true }, take: 10 },
      tasks: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 10 },
      notes: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } }, take: 20 },
      activities: { orderBy: { occurredAt: "desc" }, include: { actor: { select: { name: true } } }, take: 20 },
      _count: { select: { quotes: true, invoices: true } },
    },
  });
  if (!company) notFound();

  const opportunityColumns: DataTableColumn<(typeof company.opportunities)[number]>[] = [
    { key: "title", header: "Oportunitat", render: (item) => <span className="table-primary">{item.title}</span> },
    { key: "stage", header: "Etapa", render: (item) => <Badge tone="petrol">{item.stage.name}</Badge> },
    { key: "value", header: "Valor", align: "right", render: (item) => <span className="amount">{formatMoney(item.valueCents, item.currency)}</span> },
  ];
  const taskColumns: DataTableColumn<(typeof company.tasks)[number]>[] = [
    { key: "title", header: "Tasca", render: (task) => <span className="table-primary">{task.title}</span> },
    { key: "status", header: "Estat", render: (task) => <StatusBadge status={task.status} /> },
    { key: "due", header: "Venciment", align: "right", render: (task) => task.dueAt ? dateFormatter.format(task.dueAt) : "—" },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={[{ label: "Empreses", href: "/companies" }, { label: company.name }]}
        title={company.name}
        description={[company.legalName, company.sector].filter(Boolean).join(" · ") || "Fitxa comercial de l’empresa"}
      />
      <section className="metrics-grid" aria-label="Resum de l’empresa">
        <MetricCard label="Contactes" value={company.contacts.length} icon={ContactRound} />
        <MetricCard label="Oportunitats" value={company.opportunities.length} icon={BriefcaseBusiness} tone="blue" />
        <MetricCard label="Pressupostos" value={company._count.quotes} icon={FileText} tone="warning" />
        <MetricCard label="Tasques obertes" value={company.tasks.filter((task) => !["COMPLETED", "CANCELLED"].includes(task.status)).length} icon={CheckSquare2} />
      </section>
      <div className="content-grid">
        <Card className="span-4">
          <CardHeader><CardTitle>Dades de l’empresa</CardTitle></CardHeader>
          <CardContent>
            <p><strong>Correu:</strong> {company.email || "—"}</p>
            <p><strong>Telèfon:</strong> {company.phone || "—"}</p>
            <p><strong>NIF:</strong> {company.taxId || "—"}</p>
            <p><strong>Web:</strong> {company.website ? <a className="link-inline" href={company.website} target="_blank" rel="noreferrer">{company.website}</a> : "—"}</p>
            <p><strong>Adreça:</strong> {[company.address, company.city, company.postalCode, company.country].filter(Boolean).join(", ") || "—"}</p>
          </CardContent>
        </Card>
        <Card className="span-8">
          <CardHeader><CardTitle>Contactes</CardTitle><Link className="link-inline" href={`/contacts/new?companyId=${company.id}`}>Afegeix contacte</Link></CardHeader>
          <CardContent>
            {company.contacts.length ? company.contacts.map((contact) => (
              <p key={contact.id}><Link className="link-inline" href={`/contacts/${contact.id}`}>{[contact.firstName, contact.lastName].filter(Boolean).join(" ")}</Link> <span className="muted">· {contact.position || contact.email || "Sense càrrec"}</span></p>
            )) : <EmptyState compact icon={ContactRound} title="Sense contactes" description="Afegeix una persona de contacte a aquesta empresa." />}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Oportunitats</CardTitle></CardHeader>
        <CardContent><DataTable caption="Oportunitats de l’empresa" columns={opportunityColumns} rows={company.opportunities} getRowKey={(item) => item.id} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Tasques</CardTitle></CardHeader>
        <CardContent><DataTable caption="Tasques de l’empresa" columns={taskColumns} rows={company.tasks} getRowKey={(item) => item.id} /></CardContent>
      </Card>
      <div className="content-grid">
        <Card className="span-6">
          <CardHeader><CardTitle>Notes internes</CardTitle></CardHeader>
          <CardContent>
            <form action={addNoteAction}>
              <input type="hidden" name="entityType" value="COMPANY" />
              <input type="hidden" name="entityId" value={company.id} />
              <Field label="Nova nota" htmlFor="content"><Textarea id="content" name="content" required rows={3} /></Field>
              <FormActions><Button type="submit">Afegeix nota</Button></FormActions>
            </form>
            {company.notes.map((note) => <div key={note.id} className="ui-card__footer"><span>{note.content}</span><small className="muted">{note.author?.name ?? "Sistema"} · {dateFormatter.format(note.createdAt)}</small></div>)}
          </CardContent>
        </Card>
        <Card className="span-6">
          <CardHeader><CardTitle>Activitat recent</CardTitle></CardHeader>
          <CardContent>
            {company.activities.length ? company.activities.map((activity) => <div key={activity.id} className="ui-card__footer"><span>{activity.summary}</span><small className="muted">{dateFormatter.format(activity.occurredAt)}</small></div>) : <EmptyState compact icon={MessageSquareText} title="Sense activitat" description="L’activitat comercial apareixerà aquí." />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
