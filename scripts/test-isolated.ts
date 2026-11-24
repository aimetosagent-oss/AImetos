import { spawnSync } from "node:child_process";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { bootstrapProduction } from "./bootstrap-production";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL local");
  const source = new URL(process.env.TEST_DATABASE_URL || "");
  if (!["localhost", "127.0.0.1"].includes(source.hostname)) throw new Error("Aquest test només pot utilitzar una base dedicada local");
  const active = new URL(process.env.DATABASE_URL);
  if (source.host === active.host && source.pathname === active.pathname) throw new Error("TEST_DATABASE_URL ha de ser una instància local separada");
  const target = source;
  const admin = new pg.Client({ connectionString: source.toString() });
  await admin.connect();
  try {
    const existing = await admin.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'");
    if (existing.rows[0].count) throw new Error("La base dedicada de validació ha de començar buida");
    const env = { ...process.env, DATABASE_URL: target.toString(), DIRECT_DATABASE_URL: target.toString() };
    const migrate = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env, stdio: "inherit" });
    if (migrate.status !== 0) throw new Error("Migració temporal fallida");
    const tests = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/integration"], { env, stdio: "inherit" });
    if (tests.status !== 0) throw new Error("Integració fallida");
    const db = new PrismaClient({ datasources: { db: { url: target.toString() } } });
    try {
      const config = { SEED_DEMO_DATA: "false", ADMIN_EMAIL: "bootstrap@example.test", ADMIN_PASSWORD: "t9B!x72Qe8r4H3m6Wy0Z" };
      if (await bootstrapProduction(db, config) !== "initialized") throw new Error("Bootstrap no inicialitzat");
      if (await bootstrapProduction(db, config) !== "already-initialized") throw new Error("Bootstrap no idempotent");
      if (await db.pipelineStage.count() !== 12) throw new Error("Calen 12 etapes");
      const counts = await Promise.all([db.company.count(), db.contact.count(), db.opportunity.count(), db.task.count(), db.quote.count(), db.invoice.count(), db.form.count()]);
      if (counts.some(Boolean)) throw new Error("El bootstrap ha generat dades demo");
      console.log("Bootstrap verificat: 12 etapes, cap registre fictici, reexecució sense sobreescriptures");
    } finally { await db.$disconnect(); }
  } finally {
    await admin.end();
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Test fallit"); process.exitCode = 1; });
