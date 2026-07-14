import { describe, expect, it, vi } from "vitest";
import {
  isRetryableDocumentTransactionError,
  withSerializableRetry,
} from "@/modules/documents/transactions";

describe("document transaction retries", () => {
  it("retries Prisma P2034 conflicts and eventually returns", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(Object.assign(new Error("write conflict"), { code: "P2034" }))
      .mockRejectedValueOnce(Object.assign(new Error("serialization failure"), { meta: { code: "40001" } }))
      .mockResolvedValue("ok");

    await expect(withSerializableRetry(operation, { maxAttempts: 4, baseDelayMs: 0 })).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("stops at the configured bound", async () => {
    const error = Object.assign(new Error("Transaction failed with SQLSTATE 40001"), { code: "P2034" });
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(error);

    await expect(withSerializableRetry(operation, { maxAttempts: 3, baseDelayMs: 0 })).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not retry unrelated failures and detects nested SQLSTATE errors", async () => {
    expect(isRetryableDocumentTransactionError({ cause: { message: "SQLSTATE 40001" } })).toBe(true);
    const error = new Error("validation failed");
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(error);

    await expect(withSerializableRetry(operation, { maxAttempts: 5, baseDelayMs: 0 })).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
