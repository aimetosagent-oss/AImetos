import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { MarketSignal, RealContentRecord } from "../../packages/shared/src/domain.ts";
import { confidenceFromSample, rankRealContent, scoreRealContent } from "../../packages/analytics/src/business-content.ts";

const records = JSON.parse(readFileSync(new URL("../../data/fixtures/real-content.json", import.meta.url), "utf8")) as RealContentRecord[];
const signals = JSON.parse(readFileSync(new URL("../../data/fixtures/market-signals.json", import.meta.url), "utf8")) as MarketSignal[];

test("small samples never produce high confidence", () => {
  assert.equal(confidenceFromSample(0), "insufficient_data");
  assert.equal(confidenceFromSample(2), "early_signal");
  assert.equal(confidenceFromSample(5), "developing_pattern");
  assert.equal(confidenceFromSample(7), "developing_pattern");
  assert.equal(confidenceFromSample(12), "moderate_confidence");
  assert.notEqual(confidenceFromSample(5), "high_confidence");
});

test("business score is transparent and bounded", () => {
  const linkedin = records.filter((record) => record.platform === "linkedin" && record.comparable !== false && record.snapshots.length > 0);
  const result = scoreRealContent(linkedin[0], linkedin, signals);
  assert.ok(result.total >= 0 && result.total <= 100);
  assert.equal(result.comparablePosts, 10);
  assert.equal(result.confidence, "developing_pattern");
  assert.ok(result.breakdown.profileInterest > 0);
});

test("probable invitations do not become confirmed leads", () => {
  const linkedin = records.filter((record) => record.platform === "linkedin" && record.comparable !== false && record.snapshots.length > 0);
  const result = scoreRealContent(linkedin[0], linkedin, signals);
  assert.equal(linkedin[0].snapshots.at(-1)?.qualifiedLeads, 0);
  assert.ok(result.breakdown.commercialSignal > 0);
});

test("real ranking only includes the strongest common maturity cohort", () => {
  const linkedin = records.filter((record) => record.platform === "linkedin");
  const ranked = rankRealContent(linkedin, signals);
  assert.deepEqual(
    [...ranked.map((item) => item.record.id)].sort(),
    ["LI-01", "LI-02", "LI-03", "LI-08", "LI-09", "LI-12", "LI-15", "LI-16"].sort()
  );
  assert.ok(ranked.every((item) => item.record.snapshots.some((snapshot) => snapshot.period === "24h")));
});
