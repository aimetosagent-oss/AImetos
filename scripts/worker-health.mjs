import { stat } from "node:fs/promises";
try {
  const heartbeat = await stat(process.env.WORKER_HEARTBEAT_PATH || "/tmp/aimetos-worker-ready");
  if (Date.now() - heartbeat.mtimeMs > 120_000) process.exitCode = 1;
} catch { process.exitCode = 1; }
