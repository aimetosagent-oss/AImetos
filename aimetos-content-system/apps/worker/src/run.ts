import { runMockContentFlow, writeReport } from "../../../packages/core/src/pipeline.ts";
import { log, createRunId } from "../../../packages/logging/src/logger.ts";
import { pathToFileURL } from "node:url";

export async function runWorker() {
  const started = Date.now();
  const runId = createRunId("worker");

  try {
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
  await runWorker();
}
