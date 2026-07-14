import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { dispatchPendingOutboxEvents } from "@/modules/automation/webhooks";
import { submitPublicForm } from "@/modules/forms/service";
import { createTestFixture, removeFixture } from "./helpers";

describe("flux de formulari públic", () => {
  let fixture: Awaited<ReturnType<typeof createTestFixture>>;
  let slug: string;

  beforeAll(async () => {
    fixture = await createTestFixture("form");
    slug = `demo-${fixture.organization.slug}`;
    await db.form.create({
      data: {
        organizationId: fixture.organization.id,
        name: "Demanar una demo",
        slug,
        isActive: true,
        pipelineId: fixture.pipeline.id,
        initialStageId: fixture.stages[0].id,
        ownerId: fixture.user.id,
        createFollowUpTask: true,
        fields: {
          create: [
            { organizationId: fixture.organization.id, label: "Nom", name: "firstName", type: "TEXT", required: true, position: 0 },
            { organizationId: fixture.organization.id, label: "Correu", name: "email", type: "EMAIL", required: true, position: 1 },
            { organizationId: fixture.organization.id, label: "Telèfon", name: "phone", type: "PHONE", position: 2 },
            { organizationId: fixture.organization.id, label: "Empresa", name: "companyName", type: "TEXT", position: 3 },
          ],
        },
      },
    });
  });

  afterAll(async () => removeFixture(fixture.organization.id, fixture.user.id));

  it("crea i connecta tots els efectes transaccionals", async () => {
    const result = await submitPublicForm({
      slug,
      requestId: `request-${Date.now()}-1`,
      ip: "192.0.2.1",
      consentAccepted: true,
      values: { firstName: "Maria", email: " MARIA@EXAMPLE.TEST ", phone: "612 345 678", companyName: "Empresa Formulari" },
    });
    expect(result).toMatchObject({ success: true, spam: false });
    expect(result.contactId).toBeTruthy();
    expect(result.companyId).toBeTruthy();
    expect(result.opportunityId).toBeTruthy();
    expect(result.taskId).toBeTruthy();
    expect(await db.activity.count({ where: { organizationId: fixture.organization.id, formSubmissionId: result.submissionId } })).toBeGreaterThanOrEqual(1);
    expect(await db.outboxEvent.count({ where: { organizationId: fixture.organization.id, aggregateId: result.submissionId } })).toBe(1);
  });

  it("deduplica el contacte però conserva les dues submissions", async () => {
    await submitPublicForm({ slug, requestId: `request-${Date.now()}-2`, ip: "192.0.2.2", consentAccepted: true, values: { firstName: "Maria", email: "maria@example.test", companyName: "Empresa Formulari" } });
    expect(await db.contact.count({ where: { organizationId: fixture.organization.id, emailNormalized: "maria@example.test" } })).toBe(1);
    expect(await db.formSubmission.count({ where: { organizationId: fixture.organization.id } })).toBe(2);
    expect(await db.opportunity.count({ where: { organizationId: fixture.organization.id, source: "Formulari: Demanar una demo" } })).toBe(2);
  });

  it("resolves concurrent submissions to the same contact and company", async () => {
    const prefix = `concurrent-${Date.now()}`;
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        submitPublicForm({
          slug,
          requestId: `${prefix}-${index}`,
          ip: `198.51.100.${index + 10}`,
          consentAccepted: true,
          values: {
            firstName: "Concurrent",
            email: `${prefix}@example.test`,
            companyName: `Empresa ${prefix}`,
          },
        }),
      ),
    );

    expect(new Set(results.map((result) => result.contactId)).size).toBe(1);
    expect(new Set(results.map((result) => result.companyId)).size).toBe(1);
    expect(await db.formSubmission.count({ where: { organizationId: fixture.organization.id, requestId: { startsWith: prefix } } })).toBe(4);
  });

  it("reuses the result of an idempotent request id", async () => {
    const requestId = `idempotent-${Date.now()}`;
    const input = {
      slug,
      requestId,
      ip: "198.51.100.40",
      consentAccepted: true,
      values: { firstName: "Idempotent", email: `${requestId}@example.test` },
    };
    const first = await submitPublicForm(input);
    const second = await submitPublicForm(input);
    expect(second).toMatchObject({ submissionId: first.submissionId, opportunityId: first.opportunityId });
    expect(await db.formSubmission.count({ where: { organizationId: fixture.organization.id, requestId } })).toBe(1);
  });

  it("keeps internal outbox events but skips webhook deliveries when the form flag is disabled", async () => {
    const form = await db.form.findUniqueOrThrow({ where: { slug } });
    await db.form.update({ where: { id: form.id }, data: { webhookEnabled: false } });
    const endpoint = await db.webhookEndpoint.create({
      data: {
        organizationId: fixture.organization.id,
        name: `Endpoint disabled ${Date.now()}`,
        url: "https://example.test/webhook",
        secretEncrypted: "unused-in-dispatch",
        eventTypes: ["form.submitted", "contact.created", "contact.updated", "opportunity.created"],
      },
    });

    try {
      const result = await submitPublicForm({
        slug,
        requestId: `no-webhook-${Date.now()}`,
        ip: "198.51.100.50",
        consentAccepted: true,
        values: { firstName: "Sense webhook", email: `no-webhook-${Date.now()}@example.test` },
      });
      const events = await db.outboxEvent.findMany({
        where: {
          organizationId: fixture.organization.id,
          payload: { path: ["submissionId"], equals: result.submissionId },
        },
      });
      expect(events).toHaveLength(3);
      expect(events.every((event) => !event.webhookDispatchEnabled)).toBe(true);
      expect(await db.activity.count({ where: { organizationId: fixture.organization.id, formSubmissionId: result.submissionId } })).toBeGreaterThan(0);

      await dispatchPendingOutboxEvents(100);
      expect(await db.webhookDelivery.count({ where: { endpointId: endpoint.id, eventId: { in: events.map((event) => event.id) } } })).toBe(0);
    } finally {
      await db.form.update({ where: { id: form.id }, data: { webhookEnabled: true } });
    }
  });
});
