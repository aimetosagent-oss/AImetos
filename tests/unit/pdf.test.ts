import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  renderDocumentPdf,
  type PdfDocumentData,
} from "@/modules/documents/pdf";

function documentFixture(): PdfDocumentData {
  return {
    kind: "Factura",
    number: "F-2026-0099",
    issueDate: new Date("2026-07-14T10:00:00.000Z"),
    dueLabel: "Venciment",
    dueDate: new Date("2026-08-13T10:00:00.000Z"),
    currency: "EUR",
    subtotalCents: 800_000,
    discountCents: 0,
    taxCents: 168_000,
    totalCents: 968_000,
    paidCents: 100_000,
    notes: Array.from(
      { length: 80 },
      (_, index) => `Nota ${index + 1} amb contingut extens i traçable.`,
    ).join(" "),
    terms: "Pagament per transferència. Срок оплаты тридцать дней. 😀",
    client: {
      name: "Empresa Демонстрация 😀",
      legalName: "Empresa de proves, SL",
      taxId: "B00000099",
      address: "Carrer de la Tecnologia, 42",
      city: "Barcelona",
      postalCode: "08001",
      email: "facturacio@example.test",
    },
    organization: {
      tradeName: "AImetos",
      legalName: "AImetos, SL",
      taxId: "B00000000",
      address: "Barcelona",
      city: "Barcelona",
      postalCode: "08001",
      email: "hola@aimetos.com",
      phone: "+34 930 000 000",
      website: "https://aimetos.com",
    },
    lines: Array.from({ length: 80 }, (_, index) => ({
      description: `Línia ${index + 1} - servei d’automatització amb descripció llarga 😀`,
      quantity: 1,
      unitPriceCents: 10_000,
      taxRateBps: 2_100,
      totalCents: 12_100,
    })),
  };
}

describe("PDF comercial", () => {
  it("pagina documents llargs i substitueix glifs no disponibles sense fallar", async () => {
    const bytes = await renderDocumentPdf(documentFixture());
    const parsed = await PDFDocument.load(bytes);

    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
    expect(parsed.getPageCount()).toBeGreaterThan(2);
  });
});
