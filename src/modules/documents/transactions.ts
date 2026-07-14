import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BASE_DELAY_MS = 10;

type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
};

function retryableCode(value: unknown) {
  return value === "P2034" || value === "40001";
}

export function isRetryableDocumentTransactionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    meta?: { code?: unknown; database_error?: unknown; message?: unknown };
    cause?: unknown;
  };
  if (retryableCode(candidate.code) || retryableCode(candidate.meta?.code)) return true;

  const text = [candidate.message, candidate.meta?.database_error, candidate.meta?.message]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  if (/\b(?:P2034|40001)\b/.test(text)) return true;

  return candidate.cause ? isRetryableDocumentTransactionError(candidate.cause) : false;
}

export async function withSerializableRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}) {
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS);

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableDocumentTransactionError(error)) throw error;
      const delayMs = baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * Math.max(1, baseDelayMs));
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export function documentTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  return withSerializableRetry(() => db.$transaction(operation, { maxWait: 15_000, timeout: 20_000 }));
}
