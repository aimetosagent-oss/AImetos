import test from "node:test";
import assert from "node:assert/strict";
import { runMockContentFlow } from "../../packages/core/src/pipeline.ts";

test("E2E mock lifecycle covers analysis through report", async () => {
  const report = await runMockContentFlow();
  assert.ok(report.analysis.weightedScore > 0);
  assert.equal(report.generatedIdeas.length, 5);
  assert.ok(report.selectedIdeas.length >= 2 && report.selectedIdeas.length <= 3);
  assert.ok(report.approvedIdeas.every((idea) => idea.status === "APPROVED"));
  assert.ok(report.contents[0].article.body.includes("## Seguent pas"));
  assert.ok(report.contents[0].linkedin.text.includes("CTA:"));
  assert.ok(report.contents[0].adaptations.length >= 8);
  assert.ok(report.publications.every((publication) => publication.publicationIds.length > 0));
  assert.ok(report.auditLog.some((event) => event.nextStatus === "METRICS_COLLECTED"));
  assert.ok(report.report.summary.length > 0);
});
