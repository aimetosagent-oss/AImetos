import test from "node:test";
import assert from "node:assert/strict";
import { validateIdea, validateMetric } from "../../packages/validation/src/schemas.ts";
import { loadConfig } from "../../packages/config/src/env.ts";
import { analyzePerformance } from "../../packages/analytics/src/performance.ts";
import { editorialScore, generateFiveIdeas, selectBestIdeas } from "../../packages/strategy/src/ideation.ts";
import metrics from "../fixtures/metrics-import.ts";

test("fixture metrics are valid", () => {
  assert.ok(metrics.every((metric) => validateMetric(metric).ok));
});

test("generated ideas include one customer, one problem, funnel, consequence and proof", () => {
  const config = loadConfig();
  const ideas = generateFiveIdeas(analyzePerformance(metrics, config), "normal");
  assert.ok(ideas.every((idea) => validateIdea(idea).ok));
  assert.ok(ideas.every((idea) => ["TOFU", "MOFU", "BOFU"].includes(idea.funnelStage)));
  assert.ok(ideas.every((idea) => idea.businessConsequence.length > 10 && idea.proofOrExample.length > 10));
  assert.ok(ideas.every((idea) => idea.language === "es" && idea.editorialFamily.length > 0));
});

test("editorial variety prioritizes integrations over recently repeated families", () => {
  const config = loadConfig();
  const ideas = generateFiveIdeas(analyzePerformance(metrics, config), "normal");
  const selected = selectBestIdeas(ideas, config);
  assert.equal(selected[0]?.id, "idea_integrations_data");
  assert.equal(selected[0]?.editorialFamily, "integracions_i_dades");
  assert.ok(editorialScore(selected[0]) > editorialScore(ideas.find((idea) => idea.id === "idea_ai_criterion")!));
  assert.equal(new Set(selected.map((idea) => idea.editorialFamily)).size, selected.length);
});

test("idea approval is blocked when funnel metadata is missing", () => {
  const config = loadConfig();
  const idea = generateFiveIdeas(analyzePerformance(metrics, config), "normal")[0];
  const invalid = { ...idea, funnelStage: undefined, businessConsequence: "", proofOrExample: "" };
  const result = validateIdea(invalid as typeof idea);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((item) => item.path === "funnelStage"));
});
