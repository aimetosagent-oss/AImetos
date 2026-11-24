import { describe, expect, it } from "vitest";
import { csvCell, csvDocument } from "@/modules/exports/crm-csv";

describe("exportació CSV", () => {
  it("escapa cometes, comes i salts de línia", () => {
    expect(csvCell('AImetos, "CRM"\nTerrassa')).toBe('"AImetos, ""CRM""\nTerrassa"');
  });

  it("neutralitza fórmules de full de càlcul", () => {
    expect(csvCell("=HYPERLINK(\"https://example.test\")")).toBe(
      '"\'=HYPERLINK(""https://example.test"")"',
    );
    expect(csvCell("+34600000000")).toBe('"\'+34600000000"');
  });

  it("genera UTF-8 amb BOM i finals CRLF", () => {
    expect(csvDocument(["nom"], [["AImetos"]])).toBe('\uFEFF"nom"\r\n"AImetos"\r\n');
  });
});
