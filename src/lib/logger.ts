type LogLevel = "debug" | "info" | "warn" | "error";

function safeString(value: string): string {
  return value
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[REDACTED]")
    .replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s/]+@/gi, "$1[REDACTED]@")
    .replaceAll("\u0000", "")
    .slice(0, 4_000);
}

function safeContext(context: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => {
      if (/password|secret|token|authorization|cookie|api[_-]?key/i.test(key)) return [key, "[REDACTED]"];
      if (typeof value === "string") return [key, safeString(value)];
      return [key, value];
    }),
  );
}

export function logErrorMessage(error: unknown): string {
  return safeString(error instanceof Error ? error.message : String(error));
}

export function log(level: LogLevel, message: string, context: Record<string, unknown> = {}) {
  const output = JSON.stringify({ ...safeContext(context), level, message, at: new Date().toISOString() });
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.log(output);
}
