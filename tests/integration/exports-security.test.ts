import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCrmCsvExport, crmExportTypes } from "@/modules/exports/crm-csv";
import { createTestFixture, removeFixture } from "./helpers";

describe("exportacions CSV i aïllament per organització", () => {
  let first: Awaited<ReturnType<typeof createTestFixture>>;
  let second: Awaited<ReturnType<typeof createTestFixture>>;

  beforeAll(async () => {
    first = await createTestFixture("exports-a");
    second = await createTestFixture("exports-b");
  });

  afterAll(async () => {
    await removeFixture(first.organization.id, first.user.id);
    await removeFixture(second.organization.id, second.user.id);
  });

  it("no exporta empreses, contactes ni oportunitats d'una altra organització", async () => {
    for (const type of ["companies", "contacts", "opportunities"] as const) {
      const csv = await buildCrmCsvExport(first.context, type);
      expect(csv).toContain(first.company.name);
      expect(csv).not.toContain(second.company.name);
      expect(csv).not.toContain(second.organization.id);
    }
  });

  it("genera les cinc exportacions admeses", async () => {
    for (const type of crmExportTypes) {
      const csv = await buildCrmCsvExport(first.context, type);
      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv.endsWith("\r\n")).toBe(true);
    }
  });
});
