import { notFound } from "next/navigation";
import { Save } from "lucide-react";
import { Button, ButtonLink, Card, CardContent, Field, FormActions, FormGrid, Input, PageHeader, Select, Textarea } from "@/components";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { rescheduleTaskAction } from "../../actions";

export default async function RescheduleTaskPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const context = await requireTenant();
  const { id } = await params; const { error } = await searchParams;
  const task = await db.task.findFirst({ where: { id, organizationId: context.organizationId, deletedAt: null, status: { in: ["PENDING", "IN_PROGRESS"] } } });
  if (!task) notFound();
  const members = await db.membership.findMany({ where: { organizationId: context.organizationId, isActive: true, user: { isActive: true } }, include: { user: true } });
  const value = task.dueAt ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(task.dueAt).replace(" ", "T") : "";
  return <div className="page-stack"><PageHeader title="Reprograma la tasca" />
    {error ? <p className="kanban-alert" role="alert">{error}</p> : null}
    <Card><CardContent><form action={rescheduleTaskAction}>
      <input type="hidden" name="taskId" value={id} /><FormGrid>
      <Field label="Títol" htmlFor="title"><Input id="title" name="title" required defaultValue={task.title} /></Field>
      <Field label="Venciment" htmlFor="dueAt"><Input id="dueAt" name="dueAt" type="datetime-local" required defaultValue={value} /></Field>
      <Field label="Responsable" htmlFor="assignedToId"><Select id="assignedToId" name="assignedToId" required defaultValue={task.assignedToId ?? context.userId}>{members.map(m => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}</Select></Field>
      <Field label="Descripció" htmlFor="description"><Textarea id="description" name="description" defaultValue={task.description ?? ""} /></Field>
      </FormGrid><FormActions><ButtonLink href="/tasks" variant="ghost">Cancel·la</ButtonLink><Button type="submit"><Save size={17} /> Desa els canvis</Button></FormActions>
    </form></CardContent></Card></div>;
}
