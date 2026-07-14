import type { ScheduledJob } from "@prisma/client";

import { db } from "@/lib/db";
import { nextRetryAt } from "@/lib/jobs";

type JobIdRow = { id: string };

export async function purgeExpiredRateLimitCounters(batchSize = 1_000): Promise<number> {
  const expired = await db.rateLimitCounter.findMany({
    where: { expiresAt: { lt: new Date() } },
    orderBy: { expiresAt: "asc" },
    take: Math.max(1, Math.min(batchSize, 5_000)),
    select: { id: true },
  });
  if (!expired.length) return 0;
  const deleted = await db.rateLimitCounter.deleteMany({
    where: { id: { in: expired.map(({ id }) => id) } },
  });
  return deleted.count;
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replaceAll("\u0000", "").slice(0, 4_000);
}

export async function recoverStaleJobs(lockTimeoutMinutes: number, batchSize = 100): Promise<number> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - Math.max(1, lockTimeoutMinutes) * 60_000);
  const staleJobs = await db.scheduledJob.findMany({
    where: { status: "PROCESSING", lockedAt: { lt: staleBefore } },
    orderBy: { lockedAt: "asc" },
    take: Math.max(1, Math.min(batchSize, 500)),
  });

  let recovered = 0;
  for (const job of staleJobs) {
    const terminal = job.attempts >= job.maxAttempts;
    const retryAt = nextRetryAt(Math.max(1, job.attempts), now);
    await db.$transaction(async (tx) => {
      const changed = await tx.scheduledJob.updateMany({
        where: {
          id: job.id,
          status: "PROCESSING",
          lockedAt: { lt: staleBefore },
        },
        data: {
          status: terminal ? "FAILED" : "PENDING",
          runAt: terminal ? job.runAt : retryAt,
          lockedAt: null,
          lockedBy: null,
          lastError: "Lease del worker caducat; feina recuperada.",
        },
      });
      if (changed.count !== 1) return;
      recovered += 1;

      if (job.webhookDeliveryId) {
        const delivery = await tx.webhookDelivery.findUnique({
          where: { id: job.webhookDeliveryId },
          select: { id: true, status: true, attempts: true, maxAttempts: true, lockedAt: true },
        });
        if (delivery?.status === "PROCESSING" && delivery.lockedAt && delivery.lockedAt < staleBefore) {
          const deliveryTerminal = terminal || delivery.attempts >= delivery.maxAttempts;
          await tx.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: deliveryTerminal ? "FAILED" : "PENDING",
              nextAttemptAt: deliveryTerminal ? undefined : retryAt,
              lockedAt: null,
              lockedBy: null,
              lastError: "Lease del worker caducat durant l'entrega.",
            },
          });
        }
      }

      if (job.emailMessageId) {
        await tx.emailMessage.updateMany({
          where: { id: job.emailMessageId, status: "PROCESSING" },
          data: {
            status: "FAILED",
            nextAttemptAt: retryAt,
            lastError: "Lease del worker caducat durant l'enviament.",
          },
        });
      }
    });
  }
  return recovered;
}

export async function claimNextJob(workerId: string): Promise<ScheduledJob | null> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "ScheduledJob"
      SET "status" = CAST('FAILED' AS "JobStatus"),
          "lastError" = COALESCE("lastError", 'S''ha assolit el límit d''intents.'),
          "lockedAt" = NULL,
          "lockedBy" = NULL,
          "updatedAt" = NOW()
      WHERE "status" = CAST('PENDING' AS "JobStatus")
        AND "attempts" >= "maxAttempts"
    `;

    const rows = await tx.$queryRaw<JobIdRow[]>`
      SELECT "id"
      FROM "ScheduledJob"
      WHERE "status" = CAST('PENDING' AS "JobStatus")
        AND "runAt" <= NOW()
        AND "attempts" < "maxAttempts"
        AND "cancelledAt" IS NULL
      ORDER BY "runAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;
    const id = rows[0]?.id;
    if (!id) return null;

    return tx.scheduledJob.update({
      where: { id },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
        lockedAt: new Date(),
        lockedBy: workerId,
        lastError: null,
      },
    });
  });
}

export async function completeJob(jobId: string, workerId: string): Promise<boolean> {
  const result = await db.scheduledJob.updateMany({
    where: { id: jobId, status: "PROCESSING", lockedBy: workerId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  });
  return result.count === 1;
}

export async function failJob(
  job: ScheduledJob,
  workerId: string,
  error: unknown,
  permanent = false,
): Promise<{ status: "PENDING" | "FAILED"; nextRunAt: Date | null }> {
  const terminal = permanent || job.attempts >= job.maxAttempts;
  const retryAt = terminal ? null : nextRetryAt(Math.max(1, job.attempts));
  const message = errorMessage(error);

  await db.$transaction(async (tx) => {
    const changed = await tx.scheduledJob.updateMany({
      where: { id: job.id, status: "PROCESSING", lockedBy: workerId },
      data: {
        status: terminal ? "FAILED" : "PENDING",
        runAt: retryAt ?? job.runAt,
        lockedAt: null,
        lockedBy: null,
        lastError: message,
      },
    });
    if (changed.count !== 1) return;

    if (job.emailMessageId) {
      await tx.emailMessage.updateMany({
        where: { id: job.emailMessageId, status: { notIn: ["SENT", "CANCELLED"] } },
        data: {
          status: "FAILED",
          nextAttemptAt: retryAt ?? new Date(),
          lastError: message,
        },
      });
    }

    if (job.webhookDeliveryId) {
      const delivery = await tx.webhookDelivery.findUnique({
        where: { id: job.webhookDeliveryId },
        select: { id: true, status: true, attempts: true, maxAttempts: true, nextAttemptAt: true, lockedBy: true },
      });
      if (delivery?.status === "PROCESSING" && delivery.lockedBy === workerId) {
        const deliveryTerminal = terminal || delivery.attempts >= delivery.maxAttempts;
        await tx.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: deliveryTerminal ? "FAILED" : "PENDING",
            nextAttemptAt: deliveryTerminal ? delivery.nextAttemptAt : (retryAt ?? delivery.nextAttemptAt),
            lockedAt: null,
            lockedBy: null,
            lastError: message,
          },
        });
      }
    }
  });

  return { status: terminal ? "FAILED" : "PENDING", nextRunAt: retryAt };
}
