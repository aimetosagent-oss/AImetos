import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { RealContentRecord } from "../../packages/shared/src/domain.ts";
import { buildClientMonthlyReport } from "../../packages/core/src/pipeline.ts";
import {
  buildContentDirectorContext,
  createChatProvider,
  replySafely
} from "../../packages/core/src/content-director.ts";
import {
  generateEditorialReportSafely,
  type GeneratedEditorialReport
} from "../../packages/core/src/editorial-report.ts";
import { OpenAIResponsesClient } from "../../packages/core/src/openai-client.ts";

const sourceReport = await buildClientMonthlyReport();
const records = JSON.parse(
  readFileSync(new URL("../../data/fixtures/real-content.json", import.meta.url), "utf8")
) as RealContentRecord[];
const silentLogger = () => {};

function response(outputText: string, status = 200): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify({ output_text: outputText }), { status }));
}

function validGeneratedReport(): GeneratedEditorialReport {
  return {
    executiveSummary: "Síntesi OpenAI basada exclusivament en les dades rebudes.",
    executiveReading: ["Observació redactada sense mètriques inventades."],
    decision: {
      nextAction: "Intent de canvi que el backend ha de descartar",
      justification: "Justificació editorial més clara.",
      confidenceLabel: "Intent de canvi de confiança"
    },
    recommendations: sourceReport.recommendations.slice(0, 3).map((item) => ({
      title: `Intent de canvi: ${item.title}`,
      whyRecommended: "Raó sintetitzada.",
      funnelStage: item.funnelStage,
      singleObjective: "Intent de canvi d'objectiu",
      postCopy: item.postCopy,
      imagePrompt: item.imagePrompt
    })),
    socialDistribution: sourceReport.socialDistribution
      .filter((item) => ["linkedin", "meta", "facebook_personal"].includes(item.channel))
      .map((item) => ({
        channel: item.channel,
        label: item.label,
        format: item.format,
        publishTime: item.publishTime,
        reason: "Raó sintetitzada.",
        adaptation: item.adaptation
      })),
    validation: {
      metrics24h: "Mesurar la resposta inicial.",
      metrics72h: "Comparar el creixement homogeni.",
      metrics7d: "Tancar la lectura."
    }
  };
}

function contextFor(query: string) {
  return buildContentDirectorContext({ query, report: sourceReport, records });
}

test("OpenAI integration handles an absent API key", async () => {
  const client = new OpenAIResponsesClient({ logger: silentLogger });
  const provider = createChatProvider("openai", { client });
  const result = await replySafely(provider, [{ role: "user", content: "Quin post té més abast?" }], contextFor("Quin post té més abast?"));
  assert.equal(result.providerFailed, true);
  assert.equal(result.errorCode, "credential_missing");
});

test("OpenAI chat returns a successful answer", async () => {
  const client = new OpenAIResponsesClient({
    apiKey: "test-only",
    logger: silentLogger,
    fetchImpl: async () => response("La publicació amb més abast és la indicada a les dades.")
  });
  const provider = createChatProvider("openai", { client });
  const result = await replySafely(provider, [{ role: "user", content: "Quin post té més abast?" }], contextFor("Quin post té més abast?"));
  assert.equal(result.providerFailed, false);
  assert.match(result.reply, /més abast/);
});

test("OpenAI chat failure keeps a friendly dashboard response", async () => {
  const client = new OpenAIResponsesClient({
    apiKey: "test-only",
    logger: silentLogger,
    fetchImpl: async () => response("", 500)
  });
  const provider = createChatProvider("openai", { client });
  const result = await replySafely(provider, [{ role: "user", content: "Compara els posts" }], contextFor("Compara els posts"));
  assert.equal(result.providerFailed, true);
  assert.equal(result.errorCode, "unavailable");
  assert.match(result.reply, /dashboard continua funcionant/);
});

test("structured editorial report accepts valid JSON and preserves deterministic decisions", async () => {
  const client = new OpenAIResponsesClient({
    apiKey: "test-only",
    logger: silentLogger,
    fetchImpl: async () => response(JSON.stringify(validGeneratedReport()))
  });
  const result = await generateEditorialReportSafely(client, sourceReport);
  assert.equal(result.providerFailed, false);
  assert.equal(result.report.decision.nextAction, sourceReport.decision.nextAction);
  assert.equal(result.report.decision.confidenceLabel, sourceReport.decision.confidenceLabel);
  assert.equal(result.report.recommendations[0]?.title, sourceReport.recommendations[0]?.title);
  assert.equal(result.report.recommendations[0]?.singleObjective, sourceReport.recommendations[0]?.singleObjective);
  assert.equal(result.report.decision.justification, "Justificació editorial més clara.");
});

test("structured editorial report falls back on invalid JSON", async () => {
  const client = new OpenAIResponsesClient({
    apiKey: "test-only",
    logger: silentLogger,
    fetchImpl: async () => response("{not-valid-json")
  });
  const result = await generateEditorialReportSafely(client, sourceReport);
  assert.equal(result.providerFailed, true);
  assert.equal(result.errorCode, "invalid_response");
  assert.equal(result.report.decision.nextAction, sourceReport.decision.nextAction);
});

test("chat consultation does not modify dashboard data", async () => {
  const beforeReport = JSON.stringify(sourceReport);
  const beforeRecords = JSON.stringify(records);
  const client = new OpenAIResponsesClient({
    apiKey: "test-only",
    logger: silentLogger,
    fetchImpl: async () => response("Resposta de consulta.")
  });
  const provider = createChatProvider("openai", { client });
  await provider.reply([{ role: "user", content: "Què hem après?" }], contextFor("Què hem après?"));
  assert.equal(JSON.stringify(sourceReport), beforeReport);
  assert.equal(JSON.stringify(records), beforeRecords);
});

test("chat history and editorial report remain independent", async () => {
  const requestBodies: string[] = [];
  const generated = validGeneratedReport();
  const client = new OpenAIResponsesClient({
    apiKey: "test-only",
    logger: silentLogger,
    fetchImpl: async (_url, init) => {
      requestBodies.push(String(init?.body || ""));
      return requestBodies.length === 1
        ? response("Hipòtesi comentada, sense persistir-la.")
        : response(JSON.stringify(generated));
    }
  });
  const privateSuggestion = "PREFERENCIA_XYZ_98421";
  const provider = createChatProvider("openai", { client });
  await provider.reply([{ role: "user", content: privateSuggestion }], contextFor(privateSuggestion));
  await generateEditorialReportSafely(client, sourceReport);
  assert.equal(requestBodies.length, 2);
  assert.match(requestBodies[0]!, new RegExp(privateSuggestion));
  assert.doesNotMatch(requestBodies[1]!, new RegExp(privateSuggestion));
});
