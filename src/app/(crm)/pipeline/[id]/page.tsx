import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Pencil } from "lucide-react";
import { Button, ButtonLink, Card, CardContent, CardHeader, CardTitle, Field, FormActions, PageHeader, Textarea } from "@/components";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { formatMoney } from "@/lib/money";
import { addNoteAction } from "../../actions";

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { organizationId } = await requireTenant();
  const { id } = await params;
  const item = await db.opportunity.findFirst({ where: { id, organizationId, deletedAt: null }, include: {
    stage: true, company: true, contact: true, owner: true,
    notes: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
    tasks: { where: { deletedAt: null }, include: { assignedTo: true }, orderBy: { dueAt: "asc" } },
    stageHistory: { orderBy: { changedAt: "desc" }, take: 30, include: { fromStage: true, toStage: true, changedBy: { select: { name: true } } } },
  } });
  if (!item) notFound();
  const date = new Intl.DateTimeFormat("ca-ES", { timeZone: "Europe/Madrid", dateStyle: "medium", timeStyle: "short" });
  return <div className="page-stack">
    <PageHeader title={item.title} description={`${item.stage.name} · ${formatMoney(item.valueCents, item.currency)}`} breadcrumbs={[{ label: "Pipeline", href: "/pipeline" }, { label: item.title }]} actions={<>
      <ButtonLink href={`/edit/opportunities/${id}`} variant="outline"><Pencil size={17} /> Edita</ButtonLink>
      <ButtonLink href={`/tasks/new?opportunityId=${id}`}><CalendarPlus size={17} /> Programa seguiment</ButtonLink>
    </>} />
    <Card><CardContent>
      <p>Responsable: {item.owner?.name ?? "Sense assignar"}</p>
      <p>Import inicial / valor estimat: {formatMoney(item.valueCents, item.currency)}</p>
      {item.recurringAmountCents > 0 ? <p>Import recurrent: {formatMoney(item.recurringAmountCents, item.currency)} · {({ MONTHLY: "Mensual", QUARTERLY: "Trimestral", YEARLY: "Anual" } as Record<string, string>)[item.recurringInterval ?? ""]}</p> : null}
      {item.serviceStartDate ? <p>Inici previst: {item.serviceStartDate.toLocaleDateString("ca-ES", { timeZone: "Europe/Madrid" })}</p> : null}
      {item.company ? <p><Link className="link-inline" href={`/companies/${item.company.id}`}>{item.company.name}</Link></p> : null}
      {item.contact ? <p><Link className="link-inline" href={`/contacts/${item.contact.id}`}>{item.contact.firstName} {item.contact.lastName}</Link></p> : null}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Seguiment i compromisos</CardTitle></CardHeader><CardContent>
      {item.tasks.length ? item.tasks.map(task => <p key={task.id}><Link className="link-inline" href={["PENDING", "IN_PROGRESS"].includes(task.status) ? `/tasks/${task.id}` : "/tasks"}>{task.title}</Link> · {({ PENDING: "Pendent", IN_PROGRESS: "En curs", COMPLETED: "Completada", CANCELLED: "Cancel·lada" } as Record<string, string>)[task.status]} · {task.dueAt ? date.format(task.dueAt) : "Sense data"} · {task.assignedTo?.name}<br />{task.description}</p>) : <p>Sense seguiment programat</p>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Notes i reunions</CardTitle></CardHeader><CardContent>
      <form action={addNoteAction}><input type="hidden" name="entityType" value="OPPORTUNITY" /><input type="hidden" name="entityId" value={id} />
        <Field label="Nova nota" htmlFor="content"><Textarea id="content" name="content" rows={4} required /></Field>
        <FormActions><Button type="submit">Afegeix nota</Button></FormActions>
      </form>
      {item.notes.map(note => <p key={note.id}>{note.content}<br /><small>{date.format(note.createdAt)}</small></p>)}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Historial comercial</CardTitle></CardHeader><CardContent>
      {item.lostReason ? <p>Motiu de pèrdua: {item.lostReason}</p> : null}
      {item.stageHistory.map(change => <p key={change.id}>{change.fromStage?.name ?? "Creació"} → {change.toStage.name}<br /><small>{date.format(change.changedAt)} · {change.changedBy?.name ?? "Sistema"}</small>{change.reason ? <><br />{change.reason}</> : null}</p>)}
    </CardContent></Card>
  </div>;
}
