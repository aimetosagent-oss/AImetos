import { randomUUID } from "node:crypto";

const secretLike = /(api[_-]?key|token|secret|password|credential)/i;

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogRecord = {
  runId: string;
  level: LogLevel;
  time: string;
  workflow?: string;
  connector?: string;
  status?: string;
  message: string;
  durationMs?: number;
  retries?: number;
  inputSummary?: unknown;
  outputSummary?: unknown;
  error?: string;
};

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = secretLike.test(key) ? "[redacted]" : redact(inner);
    }
    return out;
  }
  return value;
}

export function createRunId(prefix = "run"): string {
  return prefix + "_" + randomUUID();
}

export function log(record: Omit<LogRecord, "time">): LogRecord {
  const safe: LogRecord = {
    ...record,
    time: new Date().toISOString(),
    inputSummary: redact(record.inputSummary),
    outputSummary: redact(record.outputSummary)
  };
  console.log(JSON.stringify(safe));
  return safe;
}
