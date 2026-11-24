import { describe, expect, it } from "vitest";
import { isSamePostgresDatabase } from "../../scripts/postgres-restore";

describe("protecció de restauració PostgreSQL", () => {
  it("detecta la mateixa base encara que canviïn credencials i paràmetres", () => {
    expect(
      isSamePostgresDatabase(
        "postgresql://app:secret@DB.internal:5432/aimetos?schema=public",
        "postgresql://admin:other@db.internal/aimetos?sslmode=require",
      ),
    ).toBe(true);
  });

  it("permet una base de restauració separada", () => {
    expect(
      isSamePostgresDatabase(
        "postgresql://app:secret@db.internal:5432/aimetos",
        "postgresql://app:secret@db.internal:5432/aimetos_restore",
      ),
    ).toBe(false);
  });
});
