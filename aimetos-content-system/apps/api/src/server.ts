import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadConfig } from "../../../packages/config/src/env.ts";
import { buildClientMonthlyReport, loadRealContentWithManualEntries, runMockContentFlow, writeReport } from "../../../packages/core/src/pipeline.ts";
import {
  buildContentDirectorContext,
  createChatProvider,
  replySafely
} from "../../../packages/core/src/content-director.ts";
import { ChatConversationStore } from "../../../packages/core/src/chat-store.ts";
import { OpenAIResponsesClient } from "../../../packages/core/src/openai-client.ts";
import { generateEditorialReportSafely } from "../../../packages/core/src/editorial-report.ts";
import {
  EditorialControlStore,
  type EditorialDecisionAction
} from "../../../packages/core/src/editorial-control-store.ts";
import { LinkedInRuntime } from "../../../packages/linkedin/src/runtime.ts";

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
  if (!["manual_user_report", "real_export", "real_screenshot", "dashboard_derived", "pending"].includes(input.sourceType)) issues.push("sourceType");
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
  const pendingIds = posts.filter((post) => post.snapshots === 0).map((post) => post.id);

  return {
    clientName: "Roger Arnau / AImetos",
    source: "LinkedIn",
    mode: "manual-first",
    canReadPublicUrl: false,
    reason: metricsComplete
      ? "Totes les publicacions registrades tenen com a mínim una captura de mètriques."
      : `${posts.length} publicacions reals registrades. Pendents de captura: ${pendingIds.join(", ")}.`,
    posts,
    requiredMetrics: ["impressions/views", "reach", "reactions", "comments", "shares", "saves", "profileViews", "followers", "invites", "leads", "meetings"],
    metricsComplete,
    nextStep: metricsComplete
      ? "Totes les peces tenen com a mínim una captura manual o exportada."
      : `Afegir la primera captura de ${pendingIds.join(" i ")} mitjançant el formulari manual.`
  };
}

export function createAimetosServer() {
  const config = loadConfig();
  const linkedInRuntime = new LinkedInRuntime(config, root);
  const chatStore = new ChatConversationStore(join(root, "data", "runtime", "content-director-conversations.json"));
  const editorialControlStore = new EditorialControlStore(join(root, "data", "runtime", "editorial-control.json"));
  const openAiClient = new OpenAIResponsesClient({
    apiKey: config.openAiApiKey,
    model: config.openAiModel,
    timeoutMs: config.chatTimeoutMs
  });
  async function linkedInRecords() {
    const records = loadRealContentWithManualEntries();
    const knownPosts = JSON.parse(readFileSync(join(root, "data", "fixtures", "linkedin-posts.json"), "utf8"));
    const knownUrls = Object.fromEntries(knownPosts.filter((post) => post.id && post.url).map((post) => [post.id, post.url]));
    await linkedInRuntime.initialize(records, knownUrls);
    return linkedInRuntime.editorialRecords(records);
  }
  async function buildLiveReport() {
    return buildClientMonthlyReport({}, {
      controlState: editorialControlStore.getState(),
      realContentRecords: await linkedInRecords()
    });
  }
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
        return json(res, 200, {
          mode: config.appMode,
          scenario: config.mockScenario,
          thresholds: config.thresholds,
          chat: {
            enabled: config.chatEnabled,
            provider: config.chatProvider,
            status:
              config.chatProvider === "mock"
                ? "local"
                : config.openAiApiKey
                  ? "connected"
                  : "credential_missing"
          }
        });
      }
      if (url.pathname === "/api/linkedin/status" && req.method === "GET") {
        await linkedInRecords();
        return json(res, 200, await linkedInRuntime.status());
      }
      if (url.pathname === "/api/linkedin/connect" && req.method === "GET") {
        if (!linkedInRuntime.oauth.isConfigured()) {
          return json(res, 503, { ok: false, error: "LinkedIn OAuth is ready, but app approval and environment configuration are still required." });
        }
        res.writeHead(302, { location: await linkedInRuntime.oauth.createAuthorizationUrl(), "cache-control": "no-store" });
        return res.end();
      }
      if (url.pathname === "/api/linkedin/oauth/callback" && req.method === "GET") {
        await linkedInRuntime.oauth.completeAuthorization(url.searchParams.get("code") || "", url.searchParams.get("state") || "");
        res.writeHead(302, { location: "/?linkedin=connected", "cache-control": "no-store" });
        return res.end();
      }
      if (url.pathname === "/api/linkedin/disconnect" && req.method === "POST") {
        await linkedInRuntime.store.disconnectAccount();
        return json(res, 200, { ok: true });
      }
      if (url.pathname === "/api/linkedin/sync" && req.method === "POST") {
        await linkedInRecords();
        if (!linkedInRuntime.sync) return json(res, 503, { ok: false, error: "LinkedIn API version or token encryption key is not configured." });
        const run = await linkedInRuntime.sync.syncLinkedIn("manual");
        return json(res, run.status === "error" ? 502 : 200, { ok: run.status !== "error", run, status: await linkedInRuntime.status() });
      }
      if (url.pathname === "/api/linkedin/posts" && req.method === "GET") {
        await linkedInRecords();
        return json(res, 200, await linkedInRuntime.store.listPosts());
      }
      if (url.pathname === "/api/linkedin/posts" && req.method === "POST") {
        const input = await readJsonBody(req);
        if (!input.url) return json(res, 400, { ok: false, error: "Cal indicar la URL pública del post." });
        const post = await linkedInRuntime.registerPost({
          url: String(input.url),
          linkedinUrn: typeof input.linkedinUrn === "string" ? input.linkedinUrn : undefined,
          internalContentId: typeof input.internalContentId === "string" ? input.internalContentId : undefined,
          publishedAt: typeof input.publishedAt === "string" ? input.publishedAt : undefined,
          hook: typeof input.hook === "string" ? input.hook : undefined,
          format: typeof input.format === "string" ? input.format : undefined,
          editorialFamily: typeof input.editorialFamily === "string" ? input.editorialFamily : undefined
        });
        return json(res, 201, { ok: true, post });
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
        return json(res, 200, await buildLiveReport());
      }
      if (url.pathname === "/api/content-decision" && req.method === "GET") {
        const report = await buildLiveReport();
        return json(res, 200, {
          decision: report.contentDecision,
          state: report.editorialState
        });
      }
      if (url.pathname === "/api/content-decision/actions" && req.method === "POST") {
        const input = await readJsonBody(req);
        const action = String(input.action || "") as EditorialDecisionAction;
        if (!["approve", "reject", "regenerate_alternative"].includes(action)) {
          return json(res, 400, { ok: false, error: "Acció editorial no vàlida." });
        }
        const report = await buildLiveReport();
        if (String(input.decisionId || "") !== report.contentDecision.decision_id) {
          return json(res, 409, { ok: false, error: "La decisió ha canviat. Actualitza l'informe abans de continuar." });
        }
        const feedback = editorialControlStore.record(action, report.contentDecision, {
          reason: typeof input.reason === "string" ? input.reason : undefined,
          conversationId: typeof input.conversationId === "string" ? input.conversationId : undefined
        });
        const updated = await buildLiveReport();
        return json(res, 200, { ok: true, feedback, report: updated });
      }
      if (url.pathname === "/api/editorial-report" && req.method === "POST") {
        const sourceReport = await buildLiveReport();
        const result = await generateEditorialReportSafely(openAiClient, sourceReport);
        return json(res, 200, {
          ok: !result.providerFailed,
          provider: "openai",
          providerStatus: result.providerFailed ? result.errorCode : "ready",
          sourceReportId: sourceReport.reportId,
          report: result.report
        });
      }
      if (url.pathname === "/api/content-director/conversations" && req.method === "GET") {
        return json(
          res,
          200,
          chatStore.list().map(({ id, title, createdAt, updatedAt, messages }) => ({
            id,
            title,
            createdAt,
            updatedAt,
            messageCount: messages.length
          }))
        );
      }
      if (url.pathname === "/api/content-director/conversations" && req.method === "POST") {
        return json(res, 201, chatStore.create());
      }
      const conversationMatch = url.pathname.match(/^\/api\/content-director\/conversations\/([^/]+)$/);
      if (conversationMatch && req.method === "GET") {
        const conversation = chatStore.get(decodeURIComponent(conversationMatch[1]));
        return conversation
          ? json(res, 200, conversation)
          : json(res, 404, { ok: false, error: "Conversa no trobada." });
      }
      if (conversationMatch && req.method === "DELETE") {
        const deleted = chatStore.delete(decodeURIComponent(conversationMatch[1]));
        return deleted
          ? json(res, 200, { ok: true })
          : json(res, 404, { ok: false, error: "Conversa no trobada." });
      }
      if (url.pathname === "/api/content-director" && req.method === "POST") {
        if (!config.chatEnabled) return json(res, 503, { ok: false, error: "El Director de contingut està desactivat." });
        const input = await readJsonBody(req);
        const question = String(input.message || "").trim();
        if (question.length < 2 || question.length > 2000) {
          return json(res, 400, { ok: false, error: "La consulta ha de tenir entre 2 i 2.000 caràcters." });
        }
        const report = await buildLiveReport();
        const records = JSON.parse(readFileSync(join(root, "data", "fixtures", "real-content.json"), "utf8"));
        const conversationId = input.conversationId || input.conversation_id;
        let conversation = conversationId ? chatStore.get(String(conversationId)) : undefined;
        if (!conversation) conversation = chatStore.create();
        const history = conversation.messages;
        conversation = chatStore.append(conversation.id, "user", question);
        const context = buildContentDirectorContext({ query: question, history, report, records });
        const provider = createChatProvider(config.chatProvider, {
          client: openAiClient
        });
        let result = await replySafely(provider, conversation.messages, context);
        let responseProvider: "mock" | "openai" = provider.name;
        let providerStatus = result.providerFailed ? result.errorCode : "ready";
        if (result.providerFailed && provider.name === "openai") {
          const fallback = createChatProvider("mock");
          result = await replySafely(fallback, conversation.messages, context);
          responseProvider = fallback.name;
          providerStatus = "fallback_local";
        }
        conversation = chatStore.append(conversation.id, "assistant", result.reply);
        return json(res, 200, {
          ok: !result.providerFailed,
          provider: responseProvider,
          providerStatus,
          reply: result.reply,
          conversation,
          contextSections: context.selectedSections
        });
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
