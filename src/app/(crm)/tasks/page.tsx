import Link from "next/link";
import { CheckSquare2, Plus } from "lucide-react";

import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

import { completeTaskAction, reopenTaskAction } from "../actions";

const dateFormatter = new Intl.DateTimeFormat("ca-ES", { dateStyle: "medium", timeStyle: "short" });
const statusLabel: Record<string, string> = { PENDING: "Pendent", IN_PROGRESS: "En curs", COMPLETED: "Completada", CANCELLED: "Cancel·lada" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; created?: string }>;
}) {
  const { organizationId } = await requireTenant();
  const { view = "pending", created } = await searchParams;
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const activeStatuses = ["PENDING", "IN_PROGRESS"] as const;
  const filter =
    view === "completed"
      ? { status: "COMPLETED" as const }
      : view === "overdue"
        ? { status: { in: [...activeStatuses] }, dueAt: { lt: now } }
        : view === "today"
          ? { status: { in: [...activeStatuses] }, dueAt: { gte: start, lt: end } }
          : view === "upcoming"
            ? { status: { in: [...activeStatuses] }, dueAt: { gte: end } }
            : { status: { in: [...activeStatuses] } };
  const tasks = await db.task.findMany({
    where: { organizationId, deletedAt: null, ...filter },
    orderBy: [{ dueAt: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    include: {
      assignedTo: { select: { name: true } },
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      opportunity: { select: { title: true } },
    },
  });
  const columns: DataTableColumn<(typeof tasks)[number]>[] = [
    { key: "task", header: "Tasca", render: (task) => <div><span className="table-primary">{task.title}</span><span className="table-secondary">{task.description || task.opportunity?.title || "Sense descripció"}</span></div> },
    { key: "status", header: "Estat", render: (task) => <StatusBadge status={task.status} label={statusLabel[task.status]} /> },
    { key: "priority", header: "Prioritat", render: (task) => task.priority === "URGENT" ? <span className="ui-badge ui-badge--danger">Urgent</span> : task.priority === "HIGH" ? <span className="ui-badge ui-badge--warning">Alta</span> : task.priority === "LOW" ? "Baixa" : "Normal" },
    { key: "relation", header: "Relacionada amb", render: (task) => task.company ? <Link className="link-inline" href={`/companies/${task.company.id}`}>{task.company.name}</Link> : task.contact ? <Link className="link-inline" href={`/contacts/${task.contact.id}`}>{[task.contact.firstName, task.contact.lastName].filter(Boolean).join(" ")}</Link> : task.opportunity?.title || "—" },
    { key: "owner", header: "Responsable", render: (task) => task.assignedTo?.name || "—" },
    { key: "due", header: "Venciment", render: (task) => <span className={task.dueAt && task.dueAt < now && task.status !== "COMPLETED" ? "ui-badge ui-badge--danger" : ""}>{task.dueAt ? dateFormatter.format(task.dueAt) : "Sense data"}</span> },
    {
      key: "action", header: "Acció", align: "right", render: (task) => task.status === "COMPLETED" ? (
        <form action={reopenTaskAction}><input type="hidden" name="taskId" value={task.id} /><Button type="submit" size="sm" variant="outline">Reobre</Button></form>
      ) : (
        <form action={completeTaskAction}><input type="hidden" name="taskId" value={task.id} /><Button type="submit" size="sm">Completa</Button></form>
      ),
    },
  ];
  const tabs = [
    ["pending", "Pendents"], ["today", "Avui"], ["overdue", "Vençudes"], ["upcoming", "Properes"], ["completed", "Completades"],
  ];

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Seguiment" title="Tasques" description="Accions comercials pendents, vençudes i completades." actions={<ButtonLink href="/tasks/new"><Plus size={17} /> Crea tasca</ButtonLink>} />
      {created ? <div className="ui-badge ui-badge--success">Tasca creada correctament.</div> : null}
      <nav className="toolbar__filters" aria-label="Filtra les tasques">
        {tabs.map(([value, label]) => <ButtonLink key={value} href={`/tasks?view=${value}`} variant={view === value ? "primary" : "outline"} size="sm">{label}</ButtonLink>)}
      </nav>
      {tasks.length ? <DataTable caption="Llista de tasques" columns={columns} rows={tasks} getRowKey={(task) => task.id} /> : <div className="ui-card"><EmptyState icon={CheckSquare2} title="No hi ha tasques en aquesta vista" description="Crea una tasca o consulta un altre filtre." action={<ButtonLink href="/tasks/new">Crea tasca</ButtonLink>} /></div>}
    </div>
  );
}
