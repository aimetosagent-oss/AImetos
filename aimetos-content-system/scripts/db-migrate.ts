import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const migrationsDir = fileURLToPath(new URL("../packages/database/prisma/migrations", import.meta.url));
const target = fileURLToPath(new URL("../data/exports/mock-migration-state.json", import.meta.url));
const migrations = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({ name: entry.name, sql: readFileSync(join(migrationsDir, entry.name, "migration.sql"), "utf8") }))
  .sort((a, b) => a.name.localeCompare(b.name));

for (const migration of migrations) {
  if (!migration.sql.trim() || /DROP\s+(TABLE|COLUMN|DATABASE)/i.test(migration.sql)) {
    throw new Error(`Migration ${migration.name} is empty or destructive`);
  }
}

if (!process.env.DATABASE_URL) {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify({
    validatedAt: new Date().toISOString(),
    migrations: migrations.map((migration) => ({ name: migration.name, statements: migration.sql.split(";").filter((part) => part.trim()).length }))
  }, null, 2) + "\n", "utf8");
  console.log(`Validated ${migrations.length} migrations without applying them because DATABASE_URL is not set.`);
} else {
  const require = createRequire(new URL("../packages/database/package.json", import.meta.url));
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS "_aimetos_migrations" ("name" TEXT PRIMARY KEY, "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    for (const migration of migrations) {
      const existing = await pool.query('SELECT 1 FROM "_aimetos_migrations" WHERE "name"=$1', [migration.name]);
      if (existing.rowCount) continue;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(migration.sql);
        await client.query('INSERT INTO "_aimetos_migrations" ("name") VALUES ($1)', [migration.name]);
        await client.query("COMMIT");
        console.log(`Applied migration ${migration.name}.`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}
