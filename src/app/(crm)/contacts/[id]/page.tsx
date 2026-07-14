import Link from "next/link";
import { BriefcaseBusiness, CheckSquare2, FileText, MessageSquareText, ReceiptText } from "lucide-react";
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

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { organizationId } = await requireTenant();
  const { id } = await params;
  const contact = await db.contact.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: {
      company: { select: { id: true, name: true } },
      opportunities: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, include: { stage: true }, take: 10 },
      tasks: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 10 },
      notes: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } }, take: 20 },
      activities: { orderBy: { occurredAt: "desc" }, include: { actor: { select: { name: true } } }, take: 20 },
      _count: { select: { quotes: true, invoices: true } },
    },
  });
  if (!contact) notFound();
  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  const opportunityColumns: DataTableColumn<(typeof contact.opportunities)[number]>[] = [
    { key: "title", header: "Oportunitat", render: (item) => <span className="table-primary">{item.title}</span> },
    { key: "stage", header: "Etapa", render: (item) => <Badge tone="petrol">{item.stage.name}</Badge> },
    { key: "value", header: "Valor", align: "right", render: (item) => <span className="amount">{formatMoney(item.valueCents, item.currency)}</span> },
  ];
  const taskColumns: DataTableColumn<(typeof contact.tasks)[number]>[] = [
    { key: "title", header: "Tasca", render: (task) => <span className="table-primary">{task.title}</span> },
    { key: "status", header: "Estat", render: (task) => <StatusBadge status={task.status} /> },
    { key: "due", header: "Venciment", align: "right", render: (task) => task.dueAt ? dateFormatter.format(task.dueAt) : "—" },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={[{ label: "Contactes", href: "/contacts" }, { label: fullName }]}
        title={fullName}
        description={[contact.position, contact.company?.name].filter(Boolean).join(" · ") || "Fitxa comercial del contacte"}
      />
      <section className="metrics-grid" aria-label="Resum del contacte">
        <MetricCard label="Oportunitats" value={contact.opportunities.length} icon={BriefcaseBusiness} />
        <MetricCard label="Tasques obertes" value={contact.tasks.filter((task) => !["COMPLETED", "CANCELLED"].includes(task.status)).length} icon={CheckSquare2} tone="blue" />
        <MetricCard label="Pressupostos" value={contact._count.quotes} icon={FileText} tone="warning" />
        <MetricCard label="Factures" value={contact._count.invoices} icon={ReceiptText} tone="success" />
      </section>
      <div className="content-grid">
        <Card className="span-4">
          <CardHeader><CardTitle>Dades de contacte</CardTitle></CardHeader>
          <CardContent>
            <p><strong>Correu:</strong> {contact.email || "—"}</p>
            <p><strong>Telèfon:</strong> {contact.phone || "—"}</p>
            <p><strong>Idioma:</strong> {contact.preferredLanguage.toUpperCase()}</p>
            <p><strong>Origen:</strong> {contact.source || "—"}</p>
            <p><strong>Empresa:</strong> {contact.company ? <Link className="link-inline" href={`/companies/${contact.company.id}`}>{contact.company.name}</Link> : "—"}</p>
          </CardContent>
        </Card>
        <Card className="span-8">
          <CardHeader><CardTitle>Oportunitats</CardTitle></CardHeader>
          <CardContent><DataTable caption="Oportunitats del contacte" columns={opportunityColumns} rows={contact.opportunities} getRowKey={(item) => item.id} /></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Tasques</CardTitle></CardHeader>
        <CardContent><DataTable caption="Tasques del contacte" columns={taskColumns} rows={contact.tasks} getRowKey={(item) => item.id} /></CardContent>
      </Card>
      <div className="content-grid">
        <Card className="span-6">
          <CardHeader><CardTitle>Notes internes</CardTitle></CardHeader>
          <CardContent>
            <form action={addNoteAction}>
              <input type="hidden" name="entityType" value="CONTACT" />
              <input type="hidden" name="entityId" value={contact.id} />
              <Field label="Nova nota" htmlFor="content"><Textarea id="content" name="content" required rows={3} /></Field>
              <FormActions><Button type="submit">Afegeix nota</Button></FormActions>
            </form>
            {contact.notes.map((note) => <div key={note.id} className="ui-card__footer"><span>{note.content}</span><small className="muted">{note.author?.name ?? "Sistema"} · {dateFormatter.format(note.createdAt)}</small></div>)}
          </CardContent>
        </Card>
        <Card className="span-6">
          <CardHeader><CardTitle>Activitat recent</CardTitle></CardHeader>
          <CardContent>
            {contact.activities.length ? contact.activities.map((activity) => <div key={activity.id} className="ui-card__footer"><span>{activity.summary}</span><small className="muted">{dateFormatter.format(activity.occurredAt)}</small></div>) : <EmptyState compact icon={MessageSquareText} title="Sense activitat" description="L’activitat comercial apareixerà aquí." />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
