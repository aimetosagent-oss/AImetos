import { gunzip } from "node:zlib";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import pg from "pg";
import type { PostgresLogicalBackup } from "./postgres-backup";

const gunzipAsync = promisify(gunzip);
const { Client } = pg;

function identifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

export function isSamePostgresDatabase(first: string, second: string): boolean {
  try {
    const left = new URL(first);
    const right = new URL(second);
    const identity = (value: URL) =>
      `${value.hostname.toLowerCase()}:${value.port || "5432"}/${decodeURIComponent(value.pathname.replace(/^\//, ""))}`;
    return identity(left) === identity(right);
  } catch {
    return first === second;
  }
}

function reviveBuffer(_: string, value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "type" in value &&
    value.type === "Buffer" &&
    "data" in value &&
    Array.isArray(value.data)
  ) {
    return Buffer.from(value.data);
  }
  return value;
}

export async function readPostgresBackup(backupFile: string): Promise<PostgresLogicalBackup> {
  const contents = await gunzipAsync(await readFile(backupFile));
  const parsed = JSON.parse(contents.toString("utf8"), reviveBuffer) as PostgresLogicalBackup;
  if (parsed.format !== "aimetos-postgres-logical-v1" || !Array.isArray(parsed.tables)) {
    throw new Error("El fitxer no és un backup AImetos compatible.");
  }
  return parsed;
}

export async function restorePostgresBackup(databaseUrl: string, backupFile: string): Promise<number> {
  if (!databaseUrl) throw new Error("Falta RESTORE_DATABASE_URL o --database-url.");
  const activeUrl = process.env.DATABASE_URL;
  if (activeUrl && isSamePostgresDatabase(activeUrl, databaseUrl) && !process.argv.includes("--allow-active-database")) {
    throw new Error("La restauració no pot apuntar a DATABASE_URL sense --allow-active-database.");
  }

  const backup = await readPostgresBackup(backupFile);
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const availableResult = await client.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
    );
    const available = new Set(availableResult.rows.map((row) => row.table_name));
    const jsonResult = await client.query<{ table_name: string; column_name: string }>(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND data_type IN ('json', 'jsonb')",
    );
    const jsonColumns = new Set(jsonResult.rows.map((row) => `${row.table_name}.${row.column_name}`));
    const missing = backup.tables.map((table) => table.name).filter((name) => !available.has(name));
    if (missing.length) throw new Error(`La base de destí no té l'esquema migrat. Falten: ${missing.join(", ")}`);

    await client.query("BEGIN");
    await client.query("SET LOCAL session_replication_role = replica");
    if (backup.tables.length) {
      await client.query(`TRUNCATE ${backup.tables.map((table) => identifier(table.name)).join(", ")} CASCADE`);
    }

    let restoredRows = 0;
    for (const table of backup.tables) {
      for (const row of table.rows) {
        const columns = Object.keys(row);
        if (!columns.length) continue;
        const values = columns.map((column) => {
          const value = row[column];
          return value != null && jsonColumns.has(`${table.name}.${column}`) ? JSON.stringify(value) : value;
        });
        const parameters = values.map((_, index) => `$${index + 1}`).join(", ");
        try {
          await client.query(
            `INSERT INTO ${identifier(table.name)} (${columns.map(identifier).join(", ")}) VALUES (${parameters})`,
            values,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`No s'ha pogut restaurar ${table.name} (${columns.join(", ")}): ${message}`);
        }
        restoredRows += 1;
      }
    }
    await client.query("COMMIT");
    return restoredRows;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const backupFile = argument("backup") ?? process.argv.slice(2).find((value) => !value.startsWith("--"));
  if (!backupFile) throw new Error("Indica el fitxer amb --backup=ruta o com a primer argument.");
  const databaseUrl = argument("database-url") ?? process.env.RESTORE_DATABASE_URL ?? "";
  const rows = await restorePostgresBackup(databaseUrl, backupFile);
  process.stdout.write(`Restauració completada: ${rows} files.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`Restauració fallida: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
