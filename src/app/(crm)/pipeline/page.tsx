import { BriefcaseBusiness, Plus } from "lucide-react";

import { KanbanBoard, type KanbanStageKind } from "@/components/kanban-board";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { organizationId } = await requireTenant();
  const { created } = await searchParams;
  const pipeline = await db.pipeline.findFirst({
    where: { organizationId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: {
      stages: { orderBy: { position: "asc" } },
      opportunities: {
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        include: {
          company: { select: { name: true } },
          contact: { select: { firstName: true, lastName: true } },
          owner: { select: { name: true } },
        },
      },
    },
  });

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Vendes"
        title={pipeline?.name ?? "Pipeline comercial"}
        description="Arrossega les oportunitats entre etapes o utilitza el selector de cada targeta."
        actions={<ButtonLink href="/pipeline/new"><Plus size={17} /> Crea oportunitat</ButtonLink>}
      />
      {created ? <div className="ui-badge ui-badge--success">Oportunitat creada correctament.</div> : null}
      {pipeline ? (
        <KanbanBoard
          stages={pipeline.stages.map((stage) => ({
            id: stage.id,
            name: stage.name,
            kind: stage.type as KanbanStageKind,
            color: stage.color ?? undefined,
          }))}
          opportunities={pipeline.opportunities.map((opportunity) => ({
            id: opportunity.id,
            title: opportunity.title,
            stageId: opportunity.stageId,
            companyName: opportunity.company?.name,
            contactName: opportunity.contact
              ? [opportunity.contact.firstName, opportunity.contact.lastName].filter(Boolean).join(" ")
              : undefined,
            valueCents: opportunity.valueCents,
            currency: opportunity.currency,
            probability: opportunity.probability,
            ownerName: opportunity.owner?.name,
            expectedCloseDate: opportunity.expectedCloseDate?.toISOString(),
          }))}
        />
      ) : (
        <div className="ui-card">
          <EmptyState icon={BriefcaseBusiness} title="No hi ha cap pipeline actiu" description="Executa el seed inicial o activa un pipeline des de la base de dades." />
        </div>
      )}
    </div>
  );
}
