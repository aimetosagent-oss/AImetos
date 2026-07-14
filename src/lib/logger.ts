type LogLevel = "debug" | "info" | "warn" | "error";

export function log(level: LogLevel, message: string, context: Record<string, unknown> = {}) {
  const output = JSON.stringify({ level, message, at: new Date().toISOString(), ...context });
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.log(output);
}
