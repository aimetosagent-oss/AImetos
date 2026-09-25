import { describe, expect, it } from "vitest";
import { documentPdfFilename } from "@/modules/documents/filename";

describe("documentPdfFilename", () => {
  it("utilitza el número complet de factura", () => {
    expect(documentPdfFilename("FAC-260810-01")).toBe("FAC-260810-01.pdf");
  });

  it("neteja caràcters no aptes per a capçaleres", () => {
    expect(documentPdfFilename(" PRE/260810 01 ")).toBe("PRE-260810-01.pdf");
  });
});
