import { describe, expect, it } from "vitest";
import { calculateDocument, calculateLine, formatMoney } from "@/lib/money";
import { calculateDocumentLines } from "@/modules/documents/calculation";

describe("càlcul monetari", () => {
  it("calcula descompte i impost amb arrodoniment en cèntims", () => {
    expect(calculateLine({ description: "Servei", quantity: 3, unitPriceCents: 999, discountPercent: 10, taxRate: 21 })).toMatchObject({
      subtotalCents: 2997,
      discountCents: 300,
      taxCents: 566,
      totalCents: 3263,
    });
  });

  it("suma les línies sense coma flotant", () => {
    const result = calculateDocument([
      { description: "A", quantity: 1, unitPriceCents: 10_000, taxRate: 21 },
      { description: "B", quantity: 2, unitPriceCents: 2_500, discountPercent: 20, taxRate: 10 },
    ]);
    expect(result).toMatchObject({ subtotalCents: 15_000, discountCents: 1_000, taxCents: 2_500, totalCents: 16_500 });
  });

  it("calcula basis points per als documents", () => {
    const result = calculateDocumentLines([{ description: "Backoffice", quantity: 2, unitPriceCents: 12_345, discountBps: 500, taxRateBps: 2100 }]);
    expect(result.lines[0]).toMatchObject({ subtotalCents: 24_690, discountAmountCents: 1_235, taxAmountCents: 4_926, totalCents: 28_381 });
    expect(result.totalCents).toBe(28_381);
  });

  it("formata EUR en català", () => {
    expect(formatMoney(123_456, "EUR")).toContain("1.234,56");
  });
});
