import { describe, expect, it } from "vitest";
// @ts-expect-error The startup preflight is intentionally plain Node.js.
import { productionErrors } from "../../scripts/production-preflight.mjs";

describe("production preflight", () => {
  const valid = { NODE_ENV: "production", PRODUCTION_DEPLOYMENT: "true", APP_URL: "https://crm.aimetos.com", AUTH_URL: "https://crm.aimetos.com", AUTH_SECRET: "a".repeat(64), DATABASE_URL: "postgresql://crm:unique-long-random-secret@crm-db:5432/crm", DIRECT_DATABASE_URL: "postgresql://crm:unique-long-random-secret@crm-db:5432/crm", SEED_DEMO_DATA: "false", AUTH_TRUST_HOST: "true" };
  it("accepts a private production configuration", () => expect(productionErrors(valid)).toEqual([]));
  it("rejects demo credentials, local database, and HTTP", () => {
    expect(productionErrors({ ...valid, APP_URL: "http://localhost:3000", DATABASE_URL: "postgresql://postgres:postgres@localhost/crm", SEED_DEMO_DATA: "true", AUTH_SECRET: "build-placeholder" }).length).toBe(4);
  });
});
