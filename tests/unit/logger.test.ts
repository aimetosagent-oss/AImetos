import { describe, expect, it, vi } from "vitest";
import { log, logErrorMessage } from "@/lib/logger";

describe("logs estructurats", () => {
  it("oculta secrets i credencials PostgreSQL", () => {
    const write = vi.spyOn(console, "error").mockImplementation(() => undefined);
    log("error", "server.failure", {
      password: "no-pot-sortir",
      error: "postgresql://user:supersecret@localhost:5432/aimetos",
    });
    const line = String(write.mock.calls[0]?.[0]);
    expect(line).not.toContain("no-pot-sortir");
    expect(line).not.toContain("supersecret");
    expect(line).toContain("[REDACTED]");
    write.mockRestore();
  });

  it("neteja missatges d'error abans de registrar-los", () => {
    expect(logErrorMessage(new Error("Bearer abc.def\u0000"))).toBe("Bearer [REDACTED]");
  });
});
