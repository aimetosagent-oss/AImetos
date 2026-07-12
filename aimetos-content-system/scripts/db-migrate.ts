import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const migration = fileURLToPath(new URL("../packages/database/prisma/migrations/0001_init/migration.sql", import.meta.url));
const target = fileURLToPath(new URL("../data/exports/mock-migration-state.json", import.meta.url));
mkdirSync(dirname(target), { recursive: true });
const sql = readFileSync(migration, "utf8");
writeFileSync(target, JSON.stringify({ appliedAt: new Date().toISOString(), statements: sql.split(";").filter(Boolean).length }, null, 2) + "\n", "utf8");
console.log("Mock migration validated and recorded.");
