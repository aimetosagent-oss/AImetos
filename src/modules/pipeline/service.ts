import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenant";
import { createOutboxEvent } from "@/modules/automation/outbox";

export async function moveOpportunity(
  context: TenantContext,
  input: { opportunityId: string; stageId: string; lostReason?: string | null; reason?: string | null },
) {
  return db.$transaction((tx) => moveOpportunityInTransaction(tx, context, input));
}

export async function moveOpportunityInTransaction(
  tx: Prisma.TransactionClient,
  context: { organizationId: string; userId: string | null; role: "ADMIN" | "MEMBER" },
  input: { opportunityId: string; stageId: string; lostReason?: string | null; reason?: string | null },
) {
    const opportunity = await tx.opportunity.findFirst({
      where: { id: input.opportunityId, organizationId: context.organizationId, deletedAt: null },
    });
    if (!opportunity) throw new NotFoundError("No s’ha trobat l’oportunitat");
    const stage = await tx.pipelineStage.findFirst({
      where: { id: input.stageId, organizationId: context.organizationId, pipelineId: opportunity.pipelineId },
    });
    if (!stage) throw new AppError("L’etapa no pertany a aquest pipeline", "INVALID_STAGE", 422);
    if (stage.type === "LOST" && !input.lostReason?.trim()) {
      throw new AppError("Cal indicar el motiu de pèrdua", "LOST_REASON_REQUIRED", 422);
    }
    if (opportunity.stageId === stage.id && opportunity.lostReason === (input.lostReason?.trim() || null)) return opportunity;

    const now = new Date();
    const wasClosed = opportunity.status !== "OPEN";
    const status = stage.type === "WON" ? "WON" : stage.type === "LOST" ? "LOST" : "OPEN";
    const updated = await tx.opportunity.update({
      where: { id: opportunity.id },
      data: {
        stageId: stage.id,
        status,
        probability: stage.defaultProbability,
        lostReason: stage.type === "LOST" ? input.lostReason?.trim() : null,
        closedAt: stage.type === "OPEN" ? null : now,
        reopenedAt: stage.type === "OPEN" && wasClosed ? now : opportunity.reopenedAt,
        version: { increment: 1 },
      },
    });

    await tx.opportunityStageHistory.create({
      data: {
        organizationId: context.organizationId,
        opportunityId: opportunity.id,
        fromStageId: opportunity.stageId,
        toStageId: stage.id,
        changedById: context.userId,
        reason: input.reason?.trim() || input.lostReason?.trim() || null,
      },
    });
    await tx.activity.create({
      data: {
        organizationId: context.organizationId,
        type: "STAGE_CHANGED",
        summary: `Oportunitat moguda a “${stage.name}”`,
        details: { fromStageId: opportunity.stageId, toStageId: stage.id, status, lostReason: updated.lostReason },
        actorId: context.userId,
        opportunityId: opportunity.id,
        companyId: opportunity.companyId,
        contactId: opportunity.contactId,
      },
    });
    await createOutboxEvent(tx, {
      organizationId: context.organizationId,
      eventType: "opportunity.stage_changed",
      aggregateType: "Opportunity",
      aggregateId: opportunity.id,
      idempotencyKey: `opportunity.stage_changed:${opportunity.id}:${updated.version}`,
      payload: {
        opportunityId: opportunity.id,
        fromStageId: opportunity.stageId,
        toStageId: stage.id,
        status,
        changedById: context.userId,
      },
    });
  return updated;
}
