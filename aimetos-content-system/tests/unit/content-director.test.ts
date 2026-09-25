import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { RealContentRecord } from "../../packages/shared/src/domain.ts";
import { buildClientMonthlyReport } from "../../packages/core/src/pipeline.ts";
import {
  buildContentDirectorContext,
  createChatProvider,
  loadContentDirectorInstructions,
  replySafely,
  type ChatProvider
} from "../../packages/core/src/content-director.ts";

const report = await buildClientMonthlyReport();
const records = JSON.parse(
  readFileSync(new URL("../../data/fixtures/real-content.json", import.meta.url), "utf8")
) as RealContentRecord[];

function contextFor(query: string, history = []) {
  return buildContentDirectorContext({ query, history, report, records, now: new Date("2026-08-12T09:00:00+02:00") });
}

test("context for tomorrow selects recommendation, editorial memory and temporality", () => {
  const context = contextFor("Què publicaries demà i per què?");
  assert.ok(context.selectedSections.includes("recommendation"));
  assert.ok(context.selectedSections.includes("editorial_memory"));
  assert.ok(context.selectedSections.includes("temporal"));
  assert.equal(context.recommendation?.family, "commercial_signals");
  assert.equal(context.deterministicDecision.candidate_id, "commercial-signals-job-offers");
  assert.equal(context.languages.content, "es");
  assert.equal(context.temporal?.date, "2026-08-12");
});

test("comparison context only carries recent comparable content sections", () => {
  const context = contextFor("Compara els últims posts.");
  assert.ok(context.selectedSections.includes("performance"));
  assert.equal(context.performance?.posts.length, 4);
  assert.equal(context.commercial, undefined);
  assert.equal(context.channels, undefined);
});

test("snapshot query selects the requested publication and all captures", () => {
  const context = contextFor("Com ha evolucionat LI-01 entre 24h i el resultat final?");
  assert.ok(context.selectedSections.includes("snapshots"));
  assert.deepEqual(context.performance?.posts.map((post) => post.id), ["LI-01"]);
  assert.equal(context.performance?.posts[0]?.snapshots.length, 3);
});

test("multi-turn context resolves a follow-up against the prior comparison", () => {
  const context = contextFor("Quin repetiríes?", [
    { role: "user", content: "Compara LI-01 i LI-03." },
    { role: "assistant", content: "LI-01 lidera abast i LI-03 conversa." }
  ]);
  assert.ok(context.selectedSections.includes("performance"));
  assert.ok(context.selectedSections.includes("recommendation"));
  assert.deepEqual(context.performance?.posts.map((post) => post.id), ["LI-01", "LI-03"]);
});

test("mock follow-up chooses from the posts compared in the previous turn", async () => {
  const history = [
    { role: "user" as const, content: "Compara LI-01 i LI-03 a 24h." },
    { role: "assistant" as const, content: "LI-01 lidera abast i LI-03 conversa." }
  ];
  const context = contextFor("Quin repetiríes?", history);
  const provider = createChatProvider("mock");
  const reply = await provider.reply([...history, { role: "user", content: context.query }], context);
  assert.match(reply, /em quedo amb 21\/07\/2026 · .*LI-03/);
  assert.match(reply, /no el text literal/);
});

test("mock provider compares equivalent 24h snapshots and stays in scope", async () => {
  const provider = createChatProvider("mock");
  const context = contextFor("Compara LI-01 i LI-03 a 24h.");
  const reply = await provider.reply([{ role: "user", content: context.query }], context);
  assert.match(reply, /14\/07\/2026 · .*LI-01.* lidera visibilitat/);
  assert.match(reply, /24 h/);
  assert.match(reply, /senyal inicial/);
});

test("mock provider evaluates a concrete alternative idea instead of leaking prior timing intent", async () => {
  const history = [
    { role: "user" as const, content: "Què publicaries ara?" },
    { role: "assistant" as const, content: "Mantindria l'hora actual a les 08:40." }
  ];
  const query = "No seria millor fer una trucada sense context si un email abans ja era suficient?";
  const context = contextFor(query, history);
  const provider = createChatProvider("mock");
  const reply = await provider.reply([...history, { role: "user", content: query }], context);
  assert.match(reply, /aquest angle és més concret/);
  assert.match(reply, /no cal posar IA a tot arreu/);
  assert.doesNotMatch(reply, /Confiança horària/);
});

test("out-of-scope questions are declined", async () => {
  const provider = createChatProvider("mock");
  const context = contextFor("Quin temps farà demà?");
  const reply = await provider.reply([{ role: "user", content: context.query }], context);
  assert.equal(context.scopeAllowed, false);
  assert.match(reply, /especialitzat/);
});

test("public content is generated in Spanish while explanation remains Catalan", async () => {
  const provider = createChatProvider("mock");
  const context = contextFor("Genera el text final per LinkedIn.");
  const reply = await provider.reply([{ role: "user", content: context.query }], context);
  assert.match(reply, /Text final per a LinkedIn/);
  assert.match(reply, /oferta de empleo también puede ser una señal comercial/);
  assert.equal(context.languages.ui, "ca");
  assert.equal(context.languages.content, "es");
});

test("a funnel question receives the requested post instead of generic dashboard data", async () => {
  const provider = createChatProvider("mock");
  const context = contextFor("LI-03 és TOFU, MOFU o BOFU?");
  const reply = await provider.reply([{ role: "user", content: context.query }], context);
  assert.match(reply, /LI-03/);
  assert.match(reply, /TOFU/);
});

test("OpenAI without API key returns a friendly credential state", async () => {
  const provider = createChatProvider("openai");
  const result = await replySafely(provider, [{ role: "user", content: "Què publico?" }], contextFor("Què publico?"));
  assert.equal(result.providerFailed, true);
  assert.equal(result.errorCode, "credential_missing");
  assert.match(result.reply, /Falta configurar la credencial/);
});

test("an empty OpenAI response is handled without breaking the dashboard", async () => {
  const provider = createChatProvider("openai", {
    apiKey: "test-only-key",
    fetchImpl: async () => new Response(JSON.stringify({ output: [] }), { status: 200 })
  });
  const result = await replySafely(provider, [{ role: "user", content: "Què publico?" }], contextFor("Què publico?"));
  assert.equal(result.providerFailed, true);
  assert.equal(result.errorCode, "empty_response");
  assert.match(result.reply, /cap resposta/);
});

test("provider failures never expose raw errors", async () => {
  const failingProvider: ChatProvider = {
    name: "mock",
    async reply() {
      throw new Error("private stack and secret details");
    }
  };
  const result = await replySafely(
    failingProvider,
    [{ role: "user", content: "Compara posts" }],
    contextFor("Compara posts")
  );
  assert.equal(result.providerFailed, true);
  assert.doesNotMatch(result.reply, /private stack|secret details/);
  assert.match(result.reply, /dashboard continua funcionant/);
});

test("the specialized prompt is the single complete source of truth", () => {
  const instructions = loadContentDirectorInstructions();
  assert.match(instructions, /Lean\/Toyota/);
  assert.match(instructions, /No inventis mètriques/);
  assert.match(instructions, /TOFU/);
  assert.match(instructions, /temporalitat/);
});

test("frontend does not contain or request the OpenAI API key", () => {
  const frontend = ["index.html", "app.js"].map((file) =>
    readFileSync(new URL(`../../apps/dashboard/public/${file}`, import.meta.url), "utf8")
  ).join("\n");
  assert.doesNotMatch(frontend, /OPENAI_API_KEY|api\.openai\.com|authorization.*Bearer/i);
});
