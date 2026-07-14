import { pathToFileURL } from "node:url";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { dispatchPendingOutboxEvents } from "@/modules/automation/webhooks";
import { PermanentJobError, processScheduledJob } from "@/worker/processor";
import { claimNextJob, completeJob, failJob, purgeExpiredRateLimitCounters, recoverStaleJobs } from "@/worker/queue";

type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const output = { timestamp: new Date().toISOString(), level, event, ...fields };
  const line = JSON.stringify(output);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replaceAll("\u0000", "").slice(0, 4_000);
}

function pause(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, milliseconds);
    signal.addEventListener("abort", done, { once: true });
  });
}

export async function runWorker(signal: AbortSignal): Promise<void> {
  const config = env();
  const recoveryIntervalMs = Math.max(30_000, Math.floor(config.WORKER_LOCK_TIMEOUT_MINUTES * 30_000));
  let lastRecoveryAt = 0;

  log("info", "worker.started", {
    workerId: config.WORKER_ID,
    pollIntervalMs: config.WORKER_POLL_INTERVAL_MS,
    lockTimeoutMinutes: config.WORKER_LOCK_TIMEOUT_MINUTES,
  });

  while (!signal.aborted) {
    try {
      if (Date.now() - lastRecoveryAt >= recoveryIntervalMs) {
        const [recovered, purgedRateLimits] = await Promise.all([
          recoverStaleJobs(config.WORKER_LOCK_TIMEOUT_MINUTES),
          purgeExpiredRateLimitCounters(),
        ]);
        lastRecoveryAt = Date.now();
        if (recovered > 0) log("warn", "worker.stale_jobs_recovered", { workerId: config.WORKER_ID, recovered });
        if (purgedRateLimits > 0) {
          log("info", "worker.rate_limits_purged", { workerId: config.WORKER_ID, counters: purgedRateLimits });
        }
      }

      const dispatched = await dispatchPendingOutboxEvents();
      if (dispatched > 0) log("info", "worker.outbox_dispatched", { workerId: config.WORKER_ID, events: dispatched });

      const job = await claimNextJob(config.WORKER_ID);
      if (!job) {
        await pause(config.WORKER_POLL_INTERVAL_MS, signal);
        continue;
      }

      log("info", "worker.job_claimed", {
        workerId: config.WORKER_ID,
        jobId: job.id,
        jobType: job.type,
        attempt: job.attempts,
        maxAttempts: job.maxAttempts,
      });

      try {
        await processScheduledJob(job, config.WORKER_ID);
        const completed = await completeJob(job.id, config.WORKER_ID);
        if (completed) {
          log("info", "worker.job_completed", {
            workerId: config.WORKER_ID,
            jobId: job.id,
            jobType: job.type,
            attempt: job.attempts,
          });
        }
      } catch (error) {
        const outcome = await failJob(job, config.WORKER_ID, error, error instanceof PermanentJobError);
        log(outcome.status === "FAILED" ? "error" : "warn", "worker.job_failed", {
          workerId: config.WORKER_ID,
          jobId: job.id,
          jobType: job.type,
          attempt: job.attempts,
          status: outcome.status,
          nextRunAt: outcome.nextRunAt?.toISOString() ?? null,
          error: errorMessage(error),
        });
      }
    } catch (error) {
      log("error", "worker.loop_error", { workerId: config.WORKER_ID, error: errorMessage(error) });
      await pause(config.WORKER_POLL_INTERVAL_MS, signal);
    }
  }

  log("info", "worker.stopped", { workerId: config.WORKER_ID });
}

async function main() {
  const controller = new AbortController();
  let shutdownRequested = false;

  const shutdown = (signalName: string) => {
    if (shutdownRequested) return;
    shutdownRequested = true;
    log("info", "worker.shutdown_requested", { signal: signalName });
    controller.abort();
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await runWorker(controller.signal);
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    log("error", "worker.fatal", { error: errorMessage(error) });
    process.exitCode = 1;
  });
}
