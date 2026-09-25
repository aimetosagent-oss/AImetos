import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { RealContentRecord } from "../../packages/shared/src/domain.ts";
import {
  audienceEvidenceConfidence,
  buildEditorialDecisionEvidence,
  comparePostsAtSameMaturity,
  evaluateCausalTest
} from "../../packages/analytics/src/business-content.ts";

const baseRecord = {
  platform: "linkedin",
  topic: "prova",
  editorialAngle: "prova",
  editorialFamily: "real_cases",
  format: "post",
  status: "published",
  metricsStatus: "available",
  sourceType: "real_export",
  targetCustomer: "PIMEs",
  funnelStage: "MOFU",
  comparable: true
} satisfies Partial<RealContentRecord>;

function record(id: string, snapshots: RealContentRecord["snapshots"], extra: Partial<RealContentRecord> = {}): RealContentRecord {
  return { ...baseRecord, id, title: id, snapshots, ...extra } as RealContentRecord;
}

test("a 24h post is not declared worse than a 7d post without a common window", () => {
  const initial = record("A", [{ period: "24h", impressions: 60, sourceType: "real_export" }]);
  const mature = record("B", [{ period: "7d", impressions: 200, sourceType: "real_export" }]);
  const comparison = comparePostsAtSameMaturity(initial, mature, "reach");
  assert.equal(comparison.comparable, false);
  assert.equal(comparison.winnerId, undefined);
  assert.match(comparison.reason, /no tenen cap finestra/);
});

test("a temporal reach winner remains separate from evergreen evidence", () => {
  const temporal = record(
    "TEMP",
    [{ period: "24h", impressions: 270, reach: 170, comments: 0, sourceType: "real_export" }],
    { contentNature: "temporal" }
  );
  const evergreen = record(
    "EVER",
    [{ period: "24h", impressions: 185, reach: 110, comments: 2, sourceType: "real_export" }],
    { contentNature: "evergreen" }
  );
  const evidence = buildEditorialDecisionEvidence([temporal, evergreen], "reach", "linkedin");
  assert.equal(evidence.objectiveLeaderId, "TEMP");
  assert.equal(evidence.temporalVisibilityLeaderId, "TEMP");
  assert.equal(evidence.evergreenLeaderId, "EVER");
});

test("changing topic, format and hour creates a low-confidence multivariable test", () => {
  const multivariable = record("MULTI", [], { changedVariables: ["topic", "format", "hour"] });
  assert.deepEqual(evaluateCausalTest(multivariable), {
    multivariableTest: true,
    causalConfidence: "low"
  });
});

test("Instagram performance cannot become LinkedIn decision evidence", () => {
  const linkedin = record("LI", [{ period: "24h", impressions: 80, comments: 1, sourceType: "real_export" }]);
  const linkedinSecond = record("LI-2", [{ period: "24h", impressions: 70, comments: 0, sourceType: "real_export" }]);
  const instagram = record(
    "IG",
    [{ period: "24h", views: 500, comments: 10, sourceType: "real_export" }],
    { platform: "instagram" }
  );
  const evidence = buildEditorialDecisionEvidence([linkedin, linkedinSecond, instagram], "qualified_conversation", "linkedin");
  assert.deepEqual(evidence.evidenceContentIds.sort(), ["LI", "LI-2"]);
  assert.equal(evidence.objectiveLeaderId, "LI");
  assert.notEqual(evidence.objectiveLeaderId, "IG");
});

test("heterogeneous audience snapshots stay separate and receive source confidence", () => {
  const platform = JSON.parse(
    readFileSync(new URL("../../data/fixtures/platform-snapshots.json", import.meta.url), "utf8")
  );
  assert.deepEqual(
    platform.linkedin.currentAudienceViews.map((view: { inexperiencedPercent: number }) => view.inexperiencedPercent),
    [36, 38, 36]
  );
  const exportAudience = record("AUD", [], {
    sourceType: "real_export",
    audience: { inexperiencedPercent: 36 }
  });
  const partialAudience = record("PARTIAL", [], {
    sourceType: "manual_user_report",
    audience: { inexperiencedPercent: 38 }
  });
  assert.equal(audienceEvidenceConfidence(exportAudience), "high");
  assert.equal(audienceEvidenceConfidence(partialAudience), "low");
});
