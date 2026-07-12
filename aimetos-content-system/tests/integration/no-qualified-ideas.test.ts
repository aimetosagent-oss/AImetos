import test from "node:test";
import assert from "node:assert/strict";
import { runMockContentFlow } from "../../packages/core/src/pipeline.ts";

test("no_qualified_ideas scenario does not generate content", async () => {
  const report = await runMockContentFlow({ mockScenario: "no_qualified_ideas" });
  assert.equal(report.generatedIdeas.length, 5);
  assert.equal(report.selectedIdeas.length, 0);
  assert.equal(report.contents.length, 0);
});
