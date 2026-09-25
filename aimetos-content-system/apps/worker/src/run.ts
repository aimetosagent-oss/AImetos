import { runMockContentFlow, writeReport } from "../../../packages/core/src/pipeline.ts";
import { log, createRunId } from "../../../packages/logging/src/logger.ts";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../../packages/config/src/env.ts";
import { loadRealContentWithManualEntries } from "../../../packages/core/src/pipeline.ts";
import { LinkedInRuntime } from "../../../packages/linkedin/src/runtime.ts";
import { startLinkedInScheduler } from "../../../packages/linkedin/src/scheduler.ts";

const root = fileURLToPath(new URL("../../..", import.meta.url));

export async function runWorker(options: { stayAlive?: boolean } = {}) {
  const started = Date.now();
  const runId = createRunId("worker");

  try {
    const config = loadConfig();
    if (config.linkedIn.syncEnabled) {
      const runtime = new LinkedInRuntime(config, root);
      await runtime.initialize(loadRealContentWithManualEntries());
      if (!runtime.sync) throw new Error("LinkedIn synchronization is enabled but API version or encryption key is missing");
      const scheduler = startLinkedInScheduler(runtime.sync, config.linkedIn.syncIntervalMs);
      const sync = await scheduler.tick();
      log({
        runId,
        level: "info",
        workflow: "worker.linkedin-sync",
        status: "completed",
        message: "LinkedIn synchronization scheduler started",
        durationMs: Date.now() - started,
        outputSummary: { intervalMs: config.linkedIn.syncIntervalMs, initialSync: sync || "completed" }
      });
      if (!options.stayAlive) scheduler.stop();
      return scheduler;
    }
    const report = await runMockContentFlow();
    const path = writeReport(report);
    log({
      runId,
      level: "info",
      workflow: "worker.mock-content-flow",
      status: "completed",
      message: "Mock content flow completed",
      durationMs: Date.now() - started,
      outputSummary: { path, selectedIdeas: report.selectedIdeas.length }
    });
  } catch (error) {
    log({
      runId,
      level: "error",
      workflow: "worker.mock-content-flow",
      status: "failed",
      message: "Mock content flow failed",
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error)
    });
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runWorker({ stayAlive: true });
}
