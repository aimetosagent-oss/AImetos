import { spawnSync } from "node:child_process";
import path from "node:path";
import pg from "pg";
import { createPostgresBackup } from "./postgres-backup";
import { readPostgresBackup, restorePostgresBackup } from "./postgres-restore";

const { Client } = pg;

function identifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function main() {
  const sourceUrl = process.env.DATABASE_URL;
  if (!sourceUrl) throw new Error("Falta DATABASE_URL.");
  const source = new URL(sourceUrl);
  const testDatabase = `aimetos_restore_${Date.now()}`;
  const adminUrl = new URL(sourceUrl);
  adminUrl.pathname = "/template1";
  const targetUrl = new URL(sourceUrl);
  targetUrl.pathname = `/${testDatabase}`;
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();

  const backupFile = await createPostgresBackup(sourceUrl, path.resolve("backups/postgres"));
  try {
    await admin.query(`CREATE DATABASE ${identifier(testDatabase)} TEMPLATE template0`);
    const prismaCli = path.resolve("node_modules/prisma/build/index.js");
    const migrated = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: targetUrl.toString(), DIRECT_DATABASE_URL: targetUrl.toString() },
      encoding: "utf8",
    });
    if (migrated.status !== 0) throw new Error(`Migració de la base temporal fallida: ${migrated.stderr || migrated.stdout}`);

    const restoredRows = await restorePostgresBackup(targetUrl.toString(), backupFile);
    const backup = await readPostgresBackup(backupFile);
    const target = new Client({ connectionString: targetUrl.toString() });
    await target.connect();
    try {
      for (const table of backup.tables) {
        const result = await target.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${identifier(table.name)}`);
        const actual = Number(result.rows[0]?.count ?? -1);
        if (actual !== table.rows.length) {
          throw new Error(`Recompte incorrecte a ${table.name}: esperat ${table.rows.length}, obtingut ${actual}.`);
        }
      }
    } finally {
      await target.end();
    }
    process.stdout.write(`Backup: ${backupFile}\nBase temporal: ${testDatabase}\nTaules verificades: ${backup.tables.length}\nFiles restaurades: ${restoredRows}\n`);
  } finally {
    await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [testDatabase]).catch(() => undefined);
    await admin.query(`DROP DATABASE IF EXISTS ${identifier(testDatabase)}`).catch(() => undefined);
    await admin.end();
  }
}

main().catch((error) => {
  process.stderr.write(`Verificació fallida: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
