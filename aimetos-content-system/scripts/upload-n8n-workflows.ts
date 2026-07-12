import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setDefaultResultOrder } from "node:dns";

type EnvVars = {
  N8N_BASE_URL: string;
  N8N_API_KEY: string;
};

type N8nWorkflow = {
  id?: string;
  name: string;
  active?: boolean;
  nodes: unknown[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
  staticData?: Record<string, unknown> | null;
  pinData?: Record<string, unknown>;
};

const root = fileURLToPath(new URL("..", import.meta.url));
const dryRun = process.argv.includes("--dry-run");
const apply = process.argv.includes("--apply");

setDefaultResultOrder("ipv4first");

if (!dryRun && !apply) {
  throw new Error("Use --dry-run or --apply explicitly.");
}

function loadEnv(): EnvVars {
  const envPath = join(root, ".n8n-local.env");
  const values = new Map<string, string>();
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (match) values.set(match[1], match[2].trim().replace(/^['"]|['"]$/g, ""));
  }
  const baseUrl = values.get("N8N_BASE_URL");
  const apiKey = values.get("N8N_API_KEY");
  if (!baseUrl || !apiKey) {
    throw new Error(".n8n-local.env must include N8N_BASE_URL and N8N_API_KEY.");
  }
  return { N8N_BASE_URL: baseUrl.replace(/\/$/, ""), N8N_API_KEY: apiKey };
}

function workflowFiles(): string[] {
  const base = join(root, "automation", "n8n");
  const subworkflows = readdirSync(join(base, "subworkflows"))
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => join(base, "subworkflows", file));
  const workflows = readdirSync(join(base, "workflows"))
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => join(base, "workflows", file));
  return [...subworkflows, ...workflows];
}

function cleanForCreate(workflow: N8nWorkflow): N8nWorkflow {
  return {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections || {},
    settings: workflow.settings || { executionOrder: "v1" }
  };
}

async function n8nRequest<T>(path: string, init: RequestInit, env: EnvVars): Promise<T> {
  const response = await fetch(env.N8N_BASE_URL + path, {
    ...init,
    headers: {
      "content-type": "application/json",
      "X-N8N-API-KEY": env.N8N_API_KEY,
      ...(init.headers || {})
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`n8n ${response.status} ${response.statusText}: ${body}`);
  }
  return (await response.json()) as T;
}

async function main() {
  const env = loadEnv();
  const existing = await n8nRequest<{ data: Array<{ id: string; name: string }> }>(
    "/api/v1/workflows?limit=250",
    { method: "GET" },
    env
  );
  const existingByName = new Map(existing.data.map((workflow) => [workflow.name, workflow.id]));
  const files = workflowFiles();
  const created: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const workflow = JSON.parse(readFileSync(file, "utf8")) as N8nWorkflow;
    if (existingByName.has(workflow.name)) {
      skipped.push(workflow.name);
      continue;
    }
    if (dryRun) {
      created.push(workflow.name);
      continue;
    }
    const result = await n8nRequest<{ id: string; name: string }>(
      "/api/v1/workflows",
      { method: "POST", body: JSON.stringify(cleanForCreate(workflow)) },
      env
    );
    created.push(result.name);
  }

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? "dry-run" : "apply",
        target: env.N8N_BASE_URL,
        note: "Public API imports workflows into the API key project. Folder assignment requires n8n UI/session support.",
        wouldCreateOrCreated: created.length,
        skippedExisting: skipped.length,
        names: created
      },
      null,
      2
    )
  );
}

await main();
