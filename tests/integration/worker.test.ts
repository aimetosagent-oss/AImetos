import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { claimNextJob, completeJob, failJob, recoverStaleJobs } from "@/worker/queue";
import { createTestFixture, removeFixture } from "./helpers";

describe("cua PostgreSQL del worker", () => {
  let fixture: Awaited<ReturnType<typeof createTestFixture>>;
  beforeAll(async () => { fixture = await createTestFixture("worker"); });
  afterAll(async () => removeFixture(fixture.organization.id, fixture.user.id));

  it("bloqueja i completa un job", async () => {
    const created = await db.scheduledJob.create({ data: { organizationId: fixture.organization.id, type: "GENERIC", runAt: new Date(Date.now() - 1_000), payload: { test: true }, deduplicationKey: `worker-complete-${Date.now()}` } });
    const claimed = await claimNextJob("vitest-worker");
    expect(claimed).toMatchObject({ id: created.id, status: "PROCESSING", lockedBy: "vitest-worker", attempts: 1 });
    expect(await completeJob(created.id, "vitest-worker")).toBe(true);
    expect(await db.scheduledJob.findUnique({ where: { id: created.id } })).toMatchObject({ status: "COMPLETED" });
  });

  it("reprograma errors temporals i limita intents", async () => {
    const created = await db.scheduledJob.create({ data: { organizationId: fixture.organization.id, type: "GENERIC", runAt: new Date(Date.now() - 1_000), payload: {}, maxAttempts: 2, deduplicationKey: `worker-retry-${Date.now()}` } });
    const claimed = await claimNextJob("vitest-retry");
    expect(claimed?.id).toBe(created.id);
    const result = await failJob(claimed!, "vitest-retry", new Error("Temporal"));
    expect(result.status).toBe("PENDING");
    expect(result.nextRunAt?.getTime()).toBeGreaterThan(Date.now());
    await db.scheduledJob.update({ where: { id: created.id }, data: { runAt: new Date(Date.now() - 1_000) } });
    const second = await claimNextJob("vitest-retry");
    expect((await failJob(second!, "vitest-retry", new Error("Definitiu"))).status).toBe("FAILED");
  });

  it("no executa jobs cancel·lats i recupera locks antics", async () => {
    const cancelled = await db.scheduledJob.create({ data: { organizationId: fixture.organization.id, type: "GENERIC", status: "CANCELLED", cancelledAt: new Date(), runAt: new Date(Date.now() - 1_000), payload: {}, deduplicationKey: `worker-cancel-${Date.now()}` } });
    const stale = await db.scheduledJob.create({ data: { organizationId: fixture.organization.id, type: "GENERIC", status: "PROCESSING", attempts: 1, lockedBy: "dead-worker", lockedAt: new Date(Date.now() - 20 * 60_000), runAt: new Date(Date.now() - 1_000), payload: {}, deduplicationKey: `worker-stale-${Date.now()}` } });
    expect(await recoverStaleJobs(10)).toBeGreaterThanOrEqual(1);
    expect(await db.scheduledJob.findUnique({ where: { id: stale.id } })).toMatchObject({ status: "PENDING", lockedBy: null });
    expect(await db.scheduledJob.findUnique({ where: { id: cancelled.id } })).toMatchObject({ status: "CANCELLED" });
  });
});
