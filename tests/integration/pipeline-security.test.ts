import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { moveOpportunity } from "@/modules/pipeline/service";
import { createTestFixture, removeFixture } from "./helpers";

describe("pipeline i separació d’organitzacions", () => {
  let first: Awaited<ReturnType<typeof createTestFixture>>;
  let second: Awaited<ReturnType<typeof createTestFixture>>;
  beforeAll(async () => { first = await createTestFixture("pipe-a"); second = await createTestFixture("pipe-b"); });
  afterAll(async () => { await removeFixture(first.organization.id, first.user.id); await removeFixture(second.organization.id, second.user.id); });

  it("registra el canvi d’etapa i l’outbox", async () => {
    await moveOpportunity(first.context, { opportunityId: first.opportunity.id, stageId: first.stages[1].id, reason: "Proposta preparada" });
    expect(await db.opportunity.findUnique({ where: { id: first.opportunity.id } })).toMatchObject({ stageId: first.stages[1].id, probability: 60 });
    expect(await db.opportunityStageHistory.count({ where: { organizationId: first.organization.id, opportunityId: first.opportunity.id } })).toBe(1);
    expect(await db.outboxEvent.count({ where: { organizationId: first.organization.id, eventType: "opportunity.stage_changed" } })).toBe(1);
  });

  it("no admet una etapa d’una altra organització", async () => {
    await expect(moveOpportunity(first.context, { opportunityId: first.opportunity.id, stageId: second.stages[1].id })).rejects.toMatchObject({ code: "INVALID_STAGE" });
    const opportunity = await db.opportunity.findUnique({ where: { id: first.opportunity.id } });
    expect(opportunity?.organizationId).toBe(first.organization.id);
  });
});
