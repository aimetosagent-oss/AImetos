import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadConfig } from "../../../packages/config/src/env.ts";
import { buildClientMonthlyReport, runMockContentFlow, writeReport } from "../../../packages/core/src/pipeline.ts";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const dashboardDir = join(root, "apps", "dashboard", "public");

function json(res, status, value) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer"
  });
  res.end(JSON.stringify(value, null, 2));
}

function serveStatic(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const target = join(dashboardDir, pathname.replace(/^\//, ""));
  if (!target.startsWith(dashboardDir) || !existsSync(target)) {
    return false;
  }
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml"
  };
  res.writeHead(200, { "content-type": types[extname(target)] || "text/plain; charset=utf-8" });
  res.end(readFileSync(target));
  return true;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validateManualMetric(input) {
  const issues = [];
  if (!["linkedin", "instagram", "facebook"].includes(input.platform)) issues.push("platform");
  if (!input.contentId || String(input.contentId).trim().length < 2) issues.push("contentId");
  if (!Date.parse(input.capturedAt || "")) issues.push("capturedAt");
  if (!["real_manual", "real_export", "estimated", "pending"].includes(input.sourceType)) issues.push("sourceType");
  for (const field of ["impressions", "views", "reach", "reactions", "comments", "shares", "saves", "sends", "profileViews", "followers", "invites", "leads", "meetings"]) {
    if (input[field] !== undefined && (!Number.isFinite(Number(input[field])) || Number(input[field]) < 0)) issues.push(field);
  }
  return issues;
}

export function buildLinkedInStartData(content, manualEntries) {
  const posts = content
    .filter((post) => post.platform === "linkedin")
    .map((post) => {
      const entries = manualEntries.filter((entry) => entry.contentId === post.id);
      const latestEntry = entries.at(-1);
      const snapshots = post.snapshots.length + entries.length;
      return {
        id: post.id,
        title: post.title,
        topic: post.topic,
        status: snapshots > 0 && post.status === "metrics_pending" ? "published" : post.status,
        sourceType: latestEntry?.sourceType || post.sourceType,
        snapshots
      };
    });
  const metricsComplete = posts.every((post) => post.snapshots > 0);

  return {
    clientName: "Roger Arnau / AImetos",
    source: "LinkedIn",
    mode: "manual-first",
    canReadPublicUrl: false,
    reason: metricsComplete
      ? "Totes les publicacions registrades tenen com a mínim una captura de mètriques."
      : "Sis publicacions reals registrades. Cinc tenen mètriques i LI-06 està pendent de captura.",
    posts,
    requiredMetrics: ["impressions/views", "reach", "reactions", "comments", "shares", "saves", "profileViews", "followers", "invites", "leads", "meetings"],
    metricsComplete,
    nextStep: metricsComplete
      ? "Totes les peces tenen com a mínim una captura manual o exportada."
      : "Afegir la primera captura de LI-06 mitjançant el formulari manual."
  };
}

export function createAimetosServer() {
  const config = loadConfig();
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://localhost");
      if (url.pathname === "/health" || url.pathname === "/live") {
        return json(res, 200, { ok: true, status: "healthy", mode: config.appMode });
      }
      if (url.pathname === "/ready") {
        return json(res, 200, { ok: true, status: "ready", mode: config.appMode });
      }
      if (url.pathname === "/api/config") {
        return json(res, 200, { mode: config.appMode, scenario: config.mockScenario, thresholds: config.thresholds });
      }
      if (url.pathname === "/api/run-mock-flow") {
        const report = await runMockContentFlow();
        const path = writeReport(report);
        return json(res, 200, { ...report, exportPath: path });
      }
      if (url.pathname === "/api/overview") {
        const report = await runMockContentFlow();
        return json(res, 200, {
          analysis: report.analysis,
          ideas: report.selectedIdeas,
          publications: report.publications,
          connectorHealth: report.connectorHealth
        });
      }
      if (url.pathname === "/api/client-report") {
        return json(res, 200, await buildClientMonthlyReport());
      }
      if (url.pathname === "/api/manual-metrics" && req.method === "GET") {
        const target = join(root, "data", "fixtures", "manual-metric-entries.json");
        return json(res, 200, JSON.parse(readFileSync(target, "utf8")));
      }
      if (url.pathname === "/api/manual-metrics" && req.method === "POST") {
        const input = await readJsonBody(req);
        const issues = validateManualMetric(input);
        const knownContent = JSON.parse(readFileSync(join(root, "data", "fixtures", "real-content.json"), "utf8"));
        const matchedContent = knownContent.find((item) => item.id === input.contentId);
        if (!matchedContent) issues.push("contentId_unknown");
        else if (matchedContent.platform !== input.platform) issues.push("platform_content_mismatch");
        if (issues.length > 0) return json(res, 400, { ok: false, error: "Camps invàlids", fields: issues });
        const target = join(root, "data", "fixtures", "manual-metric-entries.json");
        const entries = JSON.parse(readFileSync(target, "utf8"));
        const entry = {
          id: `manual_${Date.now()}`,
          platform: input.platform,
          contentId: String(input.contentId).trim(),
          capturedAt: input.capturedAt,
          period: input.period || "latest",
          impressions: Number(input.impressions || 0),
          views: Number(input.views || 0),
          reach: Number(input.reach || 0),
          reactions: Number(input.reactions || 0),
          comments: Number(input.comments || 0),
          shares: Number(input.shares || 0),
          saves: Number(input.saves || 0),
          sends: Number(input.sends || 0),
          profileViews: Number(input.profileViews || 0),
          followers: Number(input.followers || 0),
          invites: Number(input.invites || 0),
          leads: Number(input.leads || 0),
          meetings: Number(input.meetings || 0),
          audienceBreakdown: input.audienceBreakdown || "",
          notes: input.notes || "",
          sourceType: input.sourceType
        };
        entries.push(entry);
        writeFileSync(target, JSON.stringify(entries, null, 2) + "\n", "utf8");
        return json(res, 201, { ok: true, entry });
      }
      if (url.pathname === "/api/linkedin-start") {
        const content = JSON.parse(readFileSync(join(root, "data", "fixtures", "real-content.json"), "utf8"));
        const entries = JSON.parse(readFileSync(join(root, "data", "fixtures", "manual-metric-entries.json"), "utf8"));
        const summary = buildLinkedInStartData(content, entries);
        const { posts, metricsComplete } = summary;
        return json(res, 200, {
          clientName: "Roger Arnau / AImetos",
          source: "LinkedIn",
          mode: "manual-first",
          canReadPublicUrl: false,
          reason: summary.reason,
          posts,
          requiredMetrics: ["impressions/views", "reach", "reactions", "comments", "shares", "saves", "profileViews", "followers", "invites", "leads", "meetings"],
          metricsComplete,
          nextStep: summary.nextStep
        });
      }
      if (serveStatic(req, res)) return;
      json(res, 404, { ok: false, error: "Not found" });
    } catch (error) {
      json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = loadConfig();
  createAimetosServer().listen(config.port, () => {
    console.log("AImetos Content System running at http://localhost:" + config.port);
  });
}
