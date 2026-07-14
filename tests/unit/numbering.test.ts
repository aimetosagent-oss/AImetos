import { describe, expect, it } from "vitest";
import { formatDocumentNumber } from "@/modules/documents/numbering";

describe("numeració documental", () => {
  it("genera el format anual amb padding", () => {
    expect(formatDocumentNumber("P", 2026, 1, 4)).toBe("P-2026-0001");
    expect(formatDocumentNumber("F", 2027, 42, 5)).toBe("F-2027-00042");
  });
});
