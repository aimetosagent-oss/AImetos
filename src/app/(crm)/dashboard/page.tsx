import Link from "next/link";
import {
  Banknote,
  BriefcaseBusiness,
  CalendarCheck2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ContactRound,
  FileInput,
  FileText,
  ReceiptText,
  TrendingUp,
  UserRoundPlus,
} from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { requireTenant } from "@/lib/tenant";

const dateFormatter = new Intl.DateTimeFormat("ca-ES", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function DashboardPage() {
  const { organizationId } = await requireTenant();
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    newLeads,
    openOpportunities,
    pipelineValue,
    overdueTasks,
    todayTasks,
    pendingQuotes,
    acceptedQuotes,
    pendingInvoices,
    overdueInvoices,
    receivedPayments,
    stages,
    recentActivity,
  ] = await Promise.all([
    db.lead.count({ where: { organizationId, status: "NEW", deletedAt: null, createdAt: { gte: thirtyDaysAgo } } }),
    db.opportunity.count({ where: { organizationId, status: "OPEN", deletedAt: null } }),
    db.opportunity.aggregate({
      where: { organizationId, status: "OPEN", deletedAt: null },
      _sum: { valueCents: true },
    }),
    db.task.count({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueAt: { lt: now },
      },
    }),
    db.task.count({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueAt: { gte: startOfToday, lt: endOfToday },
      },
    }),
    db.quote.count({ where: { organizationId, status: { in: ["SENT", "VIEWED"] } } }),
    db.quote.count({ where: { organizationId, status: "ACCEPTED" } }),
    db.invoice.count({ where: { organizationId, status: { in: ["ISSUED", "SENT", "PARTIALLY_PAID"] } } }),
    db.invoice.count({ where: { organizationId, status: "OVERDUE" } }),
    db.payment.aggregate({
      where: { organizationId, status: "SUCCEEDED" },
      _sum: { amountCents: true },
    }),
    db.pipelineStage.findMany({
      where: { organizationId, pipeline: { isDefault: true, isActive: true } },
      orderBy: { position: "asc" },
      include: {
        opportunities: {
          where: { deletedAt: null, status: "OPEN" },
          select: { valueCents: true },
        },
      },
    }),
    db.activity.findMany({
      where: { organizationId },
      orderBy: { occurredAt: "desc" },
      take: 8,
      include: {
        actor: { select: { name: true } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        opportunity: { select: { title: true } },
      },
    }),
  ]);

  const activityColumns: DataTableColumn<(typeof recentActivity)[number]>[] = [
    {
      key: "activity",
      header: "Activitat",
      render: (activity) => (
        <div>
          <span className="table-primary">{activity.summary}</span>
          <span className="table-secondary">{activity.actor?.name ?? "Sistema"}</span>
        </div>
      ),
    },
    {
      key: "relation",
      header: "Relacionat amb",
      render: (activity) =>
        activity.company ? (
          <Link className="link-inline" href={`/companies/${activity.company.id}`}>
            {activity.company.name}
          </Link>
        ) : activity.contact ? (
          <Link className="link-inline" href={`/contacts/${activity.contact.id}`}>
            {[activity.contact.firstName, activity.contact.lastName].filter(Boolean).join(" ")}
          </Link>
        ) : (
          activity.opportunity?.title ?? "—"
        ),
    },
    {
      key: "date",
      header: "Data",
      align: "right",
      render: (activity) => dateFormatter.format(activity.occurredAt),
    },
  ];

  const stageColumns: DataTableColumn<(typeof stages)[number]>[] = [
    { key: "stage", header: "Etapa", render: (stage) => <span className="table-primary">{stage.name}</span> },
    { key: "count", header: "Oportunitats", align: "right", render: (stage) => stage.opportunities.length },
    {
      key: "value",
      header: "Valor",
      align: "right",
      render: (stage) => (
        <span className="amount">{formatMoney(stage.opportunities.reduce((sum, item) => sum + item.valueCents, 0))}</span>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Visió comercial"
        title="Dashboard"
        description="Indicadors actualitzats del pipeline, els documents i les tasques de seguiment."
        actions={
          <>
            <ButtonLink href="/contacts/new" variant="outline"><UserRoundPlus size={17} /> Crea contacte</ButtonLink>
            <ButtonLink href="/pipeline/new"><BriefcaseBusiness size={17} /> Crea oportunitat</ButtonLink>
          </>
        }
      />

      <section className="metrics-grid" aria-label="Indicadors comercials">
        <MetricCard label="Leads nous" value={newLeads} detail="Últims 30 dies" icon={ContactRound} href="/contacts" />
        <MetricCard label="Oportunitats obertes" value={openOpportunities} icon={BriefcaseBusiness} href="/pipeline" tone="blue" />
        <MetricCard label="Valor del pipeline" value={formatMoney(pipelineValue._sum.valueCents ?? 0)} icon={TrendingUp} href="/pipeline" />
        <MetricCard label="Tasques vençudes" value={overdueTasks} icon={Clock3} href="/tasks?view=overdue" tone={overdueTasks ? "danger" : "success"} />
        <MetricCard label="Tasques d’avui" value={todayTasks} icon={CalendarCheck2} href="/tasks?view=today" tone="blue" />
        <MetricCard label="Pressupostos pendents" value={pendingQuotes} detail={`${acceptedQuotes} acceptats`} icon={FileText} href="/quotes" tone="warning" />
        <MetricCard label="Factures pendents" value={pendingInvoices} detail={`${overdueInvoices} vençudes`} icon={ReceiptText} href="/invoices" tone={overdueInvoices ? "danger" : "blue"} />
        <MetricCard label="Import cobrat" value={formatMoney(receivedPayments._sum.amountCents ?? 0)} icon={CircleDollarSign} tone="success" />
      </section>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Accions ràpides</CardTitle>
            <p className="ui-card__description">Continua amb les tasques comercials habituals.</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="toolbar__actions">
            <ButtonLink href="/companies/new" variant="outline"><BriefcaseBusiness size={16} /> Crea empresa</ButtonLink>
            <ButtonLink href="/tasks/new" variant="outline"><CheckCircle2 size={16} /> Crea tasca</ButtonLink>
            <ButtonLink href="/quotes/new" variant="outline"><FileText size={16} /> Crea pressupost</ButtonLink>
            <ButtonLink href="/invoices/new" variant="outline"><Banknote size={16} /> Crea factura</ButtonLink>
            <ButtonLink href="/forms/new" variant="outline"><FileInput size={16} /> Crea formulari</ButtonLink>
          </div>
        </CardContent>
      </Card>

      <div className="content-grid">
        <Card className="span-5">
          <CardHeader><CardTitle>Oportunitats per etapa</CardTitle></CardHeader>
          <CardContent>
            <DataTable caption="Oportunitats per etapa" columns={stageColumns} rows={stages} getRowKey={(stage) => stage.id} />
          </CardContent>
        </Card>
        <Card className="span-7">
          <CardHeader>
            <CardTitle>Activitat recent</CardTitle>
            <Link className="link-inline" href="/activity">Mostra-ho tot</Link>
          </CardHeader>
          <CardContent>
            <DataTable caption="Activitat recent" columns={activityColumns} rows={recentActivity} getRowKey={(activity) => activity.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
