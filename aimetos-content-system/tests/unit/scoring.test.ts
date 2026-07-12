import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../packages/config/src/env.ts";
import { analyzePerformance } from "../../packages/analytics/src/performance.ts";
import { generateFiveIdeas, selectBestIdeas } from "../../packages/strategy/src/ideation.ts";
import metrics from "../fixtures/metrics-import.ts";

test("generates exactly five ideas and selects two or three quality ideas", () => {
  const config = loadConfig();
  const analysis = analyzePerformance(metrics, config);
  const ideas = generateFiveIdeas(analysis, "normal");
  const selected = selectBestIdeas(ideas, config);
  assert.equal(ideas.length, 5);
  assert.ok(selected.length >= 2 && selected.length <= 3);
  assert.ok(selected.every((idea) => idea.globalScore >= config.thresholds.minAverageScore));
});
