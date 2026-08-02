import test from "node:test";
import assert from "node:assert/strict";
import { buildClientMonthlyReport } from "../../packages/core/src/pipeline.ts";

test("client report keeps the simplified editorial decision contract", async () => {
  const report = await buildClientMonthlyReport();

  assert.equal(report.executiveReading.length, 4);
  assert.equal(report.recommendations.length, 3);
  assert.equal(report.recommendations[0]?.editorialFamily, "integracions_i_dades");
  assert.match(report.decision.nextAction, /Tu empresa no necesita otra herramienta/);
  assert.ok(report.recommendations.every((item) => item.postCopy.includes("¿") || item.postCopy.includes("Una ")));
});

test("Meta is one public channel with separate internal platform metrics", async () => {
  const report = await buildClientMonthlyReport();
  const primaryChannels = report.socialDistribution.filter((item) => item.channel === "linkedin" || item.channel === "meta");
  const meta = primaryChannels.find((item) => item.channel === "meta");

  assert.deepEqual(primaryChannels.map((item) => item.channel), ["linkedin", "meta"]);
  assert.ok(meta?.platformMetrics?.instagram.includes("Desats"));
  assert.ok(meta?.platformMetrics?.facebookBusiness.includes("Missatges"));
  assert.equal(report.socialDistribution.some((item) => item.channel === "facebook_personal"), true);
});
