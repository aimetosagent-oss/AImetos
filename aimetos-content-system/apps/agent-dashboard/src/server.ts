import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildAgentActivity, normalizeAgentEvent, validateAgentEvent } from "../../../packages/operations/src/agent-activity.ts";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const publicDir = join(root, "apps", "agent-dashboard", "public");
const eventsPath = join(root, "data", "fixtures", "agent-events.json");
const port = Number(process.env.AGENT_DASHBOARD_PORT || 4320);

function json(res, status: number, value: unknown) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer"
  });
  res.end(JSON.stringify(value, null, 2));
}

async function readJsonBody(req) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 262_144) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function serveStatic(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const target = join(publicDir, pathname.replace(/^\//, ""));
  if (!target.startsWith(publicDir) || !existsSync(target)) return false;
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".svg": "image/svg+xml" };
  res.writeHead(200, { "content-type": types[extname(target)] || "text/plain; charset=utf-8" });
  res.end(readFileSync(target));
  return true;
}

export function createAgentDashboardServer() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://localhost");
      if (url.pathname === "/health") return json(res, 200, { ok: true, service: "agent-dashboard", mode: "mock" });
      if (url.pathname === "/api/activity" && req.method === "GET") {
        return json(res, 200, buildAgentActivity(JSON.parse(readFileSync(eventsPath, "utf8"))));
      }
      if (url.pathname === "/api/events" && req.method === "POST") {
        const input = await readJsonBody(req);
        const issues = validateAgentEvent(input);
        if (issues.length) return json(res, 400, { ok: false, error: "Esdeveniment invàlid", fields: issues });
        const events = JSON.parse(readFileSync(eventsPath, "utf8"));
        const event = normalizeAgentEvent(input);
        if (events.some((item) => item.id === event.id)) return json(res, 200, { ok: true, duplicate: true, event });
        events.push(event);
        writeFileSync(eventsPath, JSON.stringify(events, null, 2) + "\n", "utf8");
        return json(res, 201, { ok: true, duplicate: false, event });
      }
      if (serveStatic(req, res)) return;
      return json(res, 404, { ok: false, error: "Not found" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json(res, message === "PAYLOAD_TOO_LARGE" ? 413 : 500, { ok: false, error: message });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createAgentDashboardServer().listen(port, () => console.log(`AImetos Agent Operations running at http://localhost:${port}`));
}
