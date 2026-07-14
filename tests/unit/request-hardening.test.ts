import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { publicRequestIdentity } from "@/lib/request-identity";
import { retryFormTransaction } from "@/modules/forms/service";

function headers(values: Record<string, string>) {
  return new Headers(values);
}

describe("public request identity", () => {
  it("ignores spoofable proxy headers by default and returns a stable fallback", () => {
    const requestHeaders = headers({
      "x-forwarded-for": "198.51.100.99, 203.0.113.8",
      "user-agent": "Browser Test/1",
      "accept-language": "ca-ES",
      "sec-ch-ua": '"Test";v="1"',
    });
    const first = publicRequestIdentity(requestHeaders, 0);
    expect(first).toEqual(publicRequestIdentity(requestHeaders, 0));
    expect(first.ip).toBeUndefined();
    expect(first.rateLimitKey).not.toContain("198.51.100.99");
  });

  it("selects from the right edge of an explicitly trusted proxy chain", () => {
    const requestHeaders = headers({ "x-forwarded-for": "192.0.2.200, 203.0.113.7, 198.51.100.4" });
    expect(publicRequestIdentity(requestHeaders, 1)).toMatchObject({ ip: "198.51.100.4" });
    expect(publicRequestIdentity(requestHeaders, 2)).toMatchObject({ ip: "203.0.113.7" });
  });

  it("falls back safely when the trusted position is missing or invalid", () => {
    const requestHeaders = headers({ "x-forwarded-for": "not-an-ip", "user-agent": "Browser Test/2" });
    expect(publicRequestIdentity(requestHeaders, 1)).toEqual({
      rateLimitKey: "fingerprint:Browser Test/2|unknown|unknown",
    });

    const brokenTrustedSuffix = headers({
      "x-forwarded-for": "192.0.2.200, 203.0.113.7, not-an-ip",
      "user-agent": "Browser Test/3",
    });
    expect(publicRequestIdentity(brokenTrustedSuffix, 2).ip).toBeUndefined();
  });
});

describe("form transaction retry", () => {
  it("retries a unique collision and refetches through a fresh operation", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("dedup collision", {
          code: "P2002",
          clientVersion: "6.19.3",
        }),
      )
      .mockResolvedValueOnce("refetched");

    await expect(retryFormTransaction(operation)).resolves.toBe("refetched");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry unrelated failures", async () => {
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(new Error("validation"));
    await expect(retryFormTransaction(operation)).rejects.toThrow("validation");
    expect(operation).toHaveBeenCalledOnce();
  });
});
