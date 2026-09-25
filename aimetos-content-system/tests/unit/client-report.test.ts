import test from "node:test";
import assert from "node:assert/strict";
import { buildClientMonthlyReport } from "../../packages/core/src/pipeline.ts";

test("client report keeps the simplified editorial decision contract", async () => {
  const report = await buildClientMonthlyReport();

  assert.equal(report.executiveReading.length, 4);
  assert.equal(report.recommendations.length, 3);
  assert.equal(report.period, "Dades disponibles fins al 24/09/2026");
  assert.equal(report.recommendations[0]?.editorialFamily, "commercial_signals");
  assert.match(report.decision.nextAction, /oferta de empleo.*señal comercial/);
  assert.equal(report.decision.temporalContext, undefined);
  assert.equal(report.decision.timing_confidence, "early_signal");
  assert.equal(report.recommendations[0]?.publishTimeLabel, "Hora recomanada actual");
  assert.match(report.recommendations[0]?.bestPublishTime || "", /Dimarts 29\/09.*08:40/);
  assert.equal(report.recommendations[0]?.timing_strategy, "maintain_time");
  assert.match(report.recommendations[0]?.timing_reason || "", /baseline/);
  assert.equal(report.decision.testObjective, "qualified_conversation");
  assert.equal(report.decision.evidenceWindow, "7d");
  assert.equal(report.decision.multivariableTest, false);
  assert.equal(report.decision.causalConfidence, "medium");
  assert.equal(report.contentDecision.candidate_id, "commercial-signals-job-offers");
  assert.equal(report.contentDecision.weekly_cadence, 1);
  assert.ok(report.recommendations.every((item) => item.postCopy.includes("¿") || item.postCopy.includes("Una ") || item.postCopy.includes("Un ")));
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
