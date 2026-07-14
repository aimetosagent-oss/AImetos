import Link from "next/link";
import { Activity as ActivityIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

const activityTypes = [
  "FORM_SUBMITTED", "CONTACT_CREATED", "CONTACT_UPDATED", "OPPORTUNITY_CREATED", "STAGE_CHANGED", "NOTE_ADDED", "TASK_CREATED", "TASK_COMPLETED", "QUOTE_CREATED", "QUOTE_SENT", "QUOTE_VIEWED", "QUOTE_ACCEPTED", "QUOTE_REJECTED", "INVOICE_CREATED", "INVOICE_SENT", "PAYMENT_RECEIVED", "EMAIL_SENT", "WEBHOOK_SENT",
] as const;

const labels: Record<string, string> = {
  FORM_SUBMITTED: "Formulari", CONTACT_CREATED: "Contacte creat", CONTACT_UPDATED: "Contacte actualitzat", OPPORTUNITY_CREATED: "Oportunitat", STAGE_CHANGED: "Canvi d’etapa", NOTE_ADDED: "Nota", TASK_CREATED: "Tasca creada", TASK_COMPLETED: "Tasca completada", QUOTE_CREATED: "Pressupost creat", QUOTE_SENT: "Pressupost enviat", QUOTE_VIEWED: "Pressupost vist", QUOTE_ACCEPTED: "Pressupost acceptat", QUOTE_REJECTED: "Pressupost rebutjat", INVOICE_CREATED: "Factura creada", INVOICE_SENT: "Factura enviada", PAYMENT_RECEIVED: "Pagament", EMAIL_SENT: "Correu", WEBHOOK_SENT: "Webhook",
};
const dateFormatter = new Intl.DateTimeFormat("ca-ES", { dateStyle: "medium", timeStyle: "short" });

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { organizationId } = await requireTenant();
  const { type: requestedType } = await searchParams;
  const type = activityTypes.includes(requestedType as (typeof activityTypes)[number])
    ? (requestedType as (typeof activityTypes)[number])
    : undefined;
  const activities = await db.activity.findMany({
    where: { organizationId, ...(type ? { type } : {}) },
    orderBy: { occurredAt: "desc" },
    take: 200,
    include: {
      actor: { select: { name: true } },
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      opportunity: { select: { title: true } },
      form: { select: { id: true, name: true } },
      task: { select: { title: true } },
      quote: { select: { id: true, number: true } },
      invoice: { select: { id: true, number: true } },
    },
  });
  const columns: DataTableColumn<(typeof activities)[number]>[] = [
    { key: "date", header: "Data", render: (activity) => dateFormatter.format(activity.occurredAt) },
    { key: "type", header: "Tipus", render: (activity) => <Badge tone="petrol">{labels[activity.type] ?? activity.type}</Badge> },
    { key: "summary", header: "Activitat", render: (activity) => <div><span className="table-primary">{activity.summary}</span><span className="table-secondary">{activity.actor?.name ?? "Sistema"}</span></div> },
    {
      key: "relation", header: "Relacionat amb", render: (activity) => {
        if (activity.company) return <Link className="link-inline" href={`/companies/${activity.company.id}`}>{activity.company.name}</Link>;
        if (activity.contact) return <Link className="link-inline" href={`/contacts/${activity.contact.id}`}>{[activity.contact.firstName, activity.contact.lastName].filter(Boolean).join(" ")}</Link>;
        if (activity.quote) return <Link className="link-inline" href={`/quotes/${activity.quote.id}`}>{activity.quote.number}</Link>;
        if (activity.invoice) return <Link className="link-inline" href={`/invoices/${activity.invoice.id}`}>{activity.invoice.number}</Link>;
        return activity.opportunity?.title || activity.form?.name || activity.task?.title || "—";
      },
    },
  ];
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Historial" title="Activitat" description="Traça cronològica de les accions comercials i automatitzades." />
      <nav className="toolbar__filters" aria-label="Filtra l’activitat">
        <ButtonLink href="/activity" size="sm" variant={!type ? "primary" : "outline"}>Tota</ButtonLink>
        <ButtonLink href="/activity?type=FORM_SUBMITTED" size="sm" variant={type === "FORM_SUBMITTED" ? "primary" : "outline"}>Formularis</ButtonLink>
        <ButtonLink href="/activity?type=STAGE_CHANGED" size="sm" variant={type === "STAGE_CHANGED" ? "primary" : "outline"}>Pipeline</ButtonLink>
        <ButtonLink href="/activity?type=TASK_COMPLETED" size="sm" variant={type === "TASK_COMPLETED" ? "primary" : "outline"}>Tasques</ButtonLink>
        <ButtonLink href="/activity?type=PAYMENT_RECEIVED" size="sm" variant={type === "PAYMENT_RECEIVED" ? "primary" : "outline"}>Pagaments</ButtonLink>
      </nav>
      {activities.length ? <DataTable caption="Historial d’activitat" columns={columns} rows={activities} getRowKey={(activity) => activity.id} /> : <div className="ui-card"><EmptyState icon={ActivityIcon} title="No hi ha activitat" description="Les accions del CRM apareixeran aquí automàticament." /></div>}
    </div>
  );
}
