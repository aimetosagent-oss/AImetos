import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, verifyWebhookSignature, webhookSignature } from "@/lib/crypto";
import { retryDelayMs } from "@/lib/jobs";

describe("signatures i secrets", () => {
  it("signa el timestamp i el body exactes", () => {
    const signature = webhookSignature("secret", "1712345678", '{"ok":true}');
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyWebhookSignature("secret", "1712345678", '{"ok":true}', signature)).toBe(true);
    expect(verifyWebhookSignature("secret", "1712345678", '{"ok":false}', signature)).toBe(false);
  });

  it("xifra secrets amb AES-GCM", () => {
    const key = Buffer.alloc(32, 7).toString("base64");
    const encrypted = encryptSecret("webhook-secret", key);
    expect(encrypted).not.toContain("webhook-secret");
    expect(decryptSecret(encrypted, key)).toBe("webhook-secret");
  });
});

describe("backoff", () => {
  it("creix exponencialment i té límit", () => {
    expect(retryDelayMs(1)).toBe(30_000);
    expect(retryDelayMs(4)).toBe(240_000);
    expect(retryDelayMs(20)).toBe(3_600_000);
  });
});
