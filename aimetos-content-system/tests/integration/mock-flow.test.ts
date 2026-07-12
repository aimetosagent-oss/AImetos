import test from "node:test";
import assert from "node:assert/strict";
import { runMockContentFlow } from "../../packages/core/src/pipeline.ts";

test("full mock flow reaches report with generated content and publications", async () => {
  const report = await runMockContentFlow();
  assert.equal(report.generatedIdeas.length, 5);
  assert.ok(report.selectedIdeas.length >= 2);
  assert.equal(report.contents.length, report.approvedIdeas.length);
  assert.ok(report.publications.every((publication) => publication.status === "published"));
  assert.equal(report.metricsCollected, true);
});
