import { hash } from "bcryptjs";
import { db } from "@/lib/db";

export async function createTestFixture(label = "test") {
  const suffix = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const user = await db.user.create({ data: { email: `${suffix}@example.test`, name: "Usuari Test", passwordHash: await hash("TestPassword123!", 4) } });
  const organization = await db.organization.create({
    data: {
      name: `Organització ${suffix}`,
      slug: suffix,
      memberships: { create: { userId: user.id, role: "ADMIN" } },
      settings: { create: { tradeName: `Org ${suffix}`, currency: "EUR", quoteFollowUpDays: [3, 7, 14], invoiceReminderOffsetsDays: [-3, 0, 3, 7] } },
    },
  });
  const pipeline = await db.pipeline.create({ data: { organizationId: organization.id, name: "Pipeline test", slug: `pipeline-${suffix}`, isDefault: true } });
  const stages = await Promise.all([
    db.pipelineStage.create({ data: { organizationId: organization.id, pipelineId: pipeline.id, name: "Lead nou", slug: "lead-nou", position: 0, type: "OPEN", defaultProbability: 10 } }),
    db.pipelineStage.create({ data: { organizationId: organization.id, pipelineId: pipeline.id, name: "Proposta enviada", slug: "proposta-enviada", position: 1, type: "OPEN", defaultProbability: 60 } }),
    db.pipelineStage.create({ data: { organizationId: organization.id, pipelineId: pipeline.id, name: "Guanyat", slug: "guanyat", position: 2, type: "WON", defaultProbability: 100 } }),
    db.pipelineStage.create({ data: { organizationId: organization.id, pipelineId: pipeline.id, name: "Perdut", slug: "perdut", position: 3, type: "LOST", defaultProbability: 0 } }),
  ]);
  const company = await db.company.create({ data: { organizationId: organization.id, name: `Empresa ${suffix}`, email: `client-${suffix}@example.test`, emailNormalized: `client-${suffix}@example.test`, ownerId: user.id } });
  const contact = await db.contact.create({ data: { organizationId: organization.id, firstName: "Anna", lastName: "Test", email: `anna-${suffix}@example.test`, emailNormalized: `anna-${suffix}@example.test`, companyId: company.id, ownerId: user.id } });
  const opportunity = await db.opportunity.create({ data: { organizationId: organization.id, title: `Oportunitat ${suffix}`, companyId: company.id, contactId: contact.id, pipelineId: pipeline.id, stageId: stages[0].id, ownerId: user.id, valueCents: 10_000 } });
  return { organization, user, pipeline, stages, company, contact, opportunity, context: { organizationId: organization.id, userId: user.id, role: "ADMIN" as const } };
}

export async function removeFixture(organizationId: string, userId: string) {
  await db.organization.delete({ where: { id: organizationId } });
  await db.user.delete({ where: { id: userId } });
}
