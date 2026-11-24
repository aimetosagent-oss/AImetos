import { gzip } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";

const gzipAsync = promisify(gzip);
const { Client } = pg;

export type PostgresLogicalBackup = {
  format: "aimetos-postgres-logical-v1";
  createdAt: string;
  database: string;
  serverVersion: string;
  tables: Array<{ name: string; rows: Array<Record<string, unknown>> }>;
};

function identifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

export async function createPostgresBackup(databaseUrl: string, outputDirectory: string): Promise<string> {
  if (!databaseUrl) throw new Error("Falta DATABASE_URL.");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const metadata = await client.query<{ database: string; version: string }>(
      "SELECT current_database() AS database, current_setting('server_version') AS version",
    );
    const tableResult = await client.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
    );
    const tables: PostgresLogicalBackup["tables"] = [];
    for (const { table_name: name } of tableResult.rows) {
      const rows = await client.query<Record<string, unknown>>(`SELECT * FROM ${identifier(name)}`);
      tables.push({ name, rows: rows.rows });
    }
    await client.query("COMMIT");

    const backup: PostgresLogicalBackup = {
      format: "aimetos-postgres-logical-v1",
      createdAt: new Date().toISOString(),
      database: metadata.rows[0]?.database ?? "unknown",
      serverVersion: metadata.rows[0]?.version ?? "unknown",
      tables,
    };
    await mkdir(outputDirectory, { recursive: true });
    const timestamp = backup.createdAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const target = path.resolve(outputDirectory, `aimetos-crm-${timestamp}.json.gz`);
    await writeFile(target, await gzipAsync(Buffer.from(JSON.stringify(backup)), { level: 9 }));
    return target;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const databaseUrl = argument("database-url") ?? process.env.DATABASE_URL ?? "";
  const outputDirectory = path.resolve(argument("output-dir") ?? "backups/postgres");
  const target = await createPostgresBackup(databaseUrl, outputDirectory);
  process.stdout.write(`${target}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`Backup fallit: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
