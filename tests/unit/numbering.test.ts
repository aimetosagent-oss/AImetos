import { describe, expect, it } from "vitest";
import { documentDateKey, formatDocumentNumber } from "@/modules/documents/numbering";

describe("numeració documental", () => {
  it("genera el format diari de pressupostos i factures", () => {
    expect(formatDocumentNumber("PRE", "260809", 1)).toBe("PRE-260809-01");
    expect(formatDocumentNumber("FAC", "260809", 12)).toBe("FAC-260809-12");
  });

  it("calcula la data segons la zona horaria de l'organitzacio", () => {
    const date = new Date("2026-08-08T22:30:00.000Z");
    expect(documentDateKey(date, "Europe/Madrid")).toBe("260809");
    expect(documentDateKey(date, "UTC")).toBe("260808");
  });
});
