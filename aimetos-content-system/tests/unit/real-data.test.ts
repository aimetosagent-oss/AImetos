import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { DataSourceType, RealContentRecord } from "../../packages/shared/src/domain.ts";

const records = JSON.parse(readFileSync(new URL("../../data/fixtures/real-content.json", import.meta.url), "utf8")) as RealContentRecord[];
const platformSnapshots = JSON.parse(
  readFileSync(new URL("../../data/fixtures/platform-snapshots.json", import.meta.url), "utf8")
);
const allowedSources = new Set<DataSourceType>([
  "real_export",
  "real_screenshot",
  "manual_user_report",
  "dashboard_derived",
  "mock",
  "pending"
]);

test("real LinkedIn and Instagram snapshots are preserved", () => {
  const byId = (id: string) => records.find((record) => record.id === id)!;
  assert.deepEqual(records.filter((record) => record.platform === "linkedin").map((record) => record.id), ["LI-00", "LI-01", "LI-02", "LI-03", "LI-04", "LI-05", "LI-06", "LI-07", "LI-08", "LI-09", "LI-10", "LI-11", "LI-12", "LI-13", "LI-14", "LI-15", "LI-16", "LI-17"]);
  assert.equal(byId("LI-01").snapshots.length, 3);
  assert.equal(byId("LI-02").snapshots.length, 2);
  assert.equal(byId("LI-03").snapshots.length, 2);
  assert.equal(byId("LI-05").snapshots.length, 2);
  assert.equal(byId("LI-08").snapshots.length, 3);
  assert.equal(byId("LI-08").snapshots.at(-1)?.impressions, 267);
  assert.equal(byId("LI-09").snapshots[0]?.impressions, 64);
  assert.equal(byId("LI-09").snapshots.at(-1)?.impressions, 221);
  assert.equal(byId("LI-08").comparable, true);
  assert.equal(byId("LI-09").comparable, true);
  assert.equal(byId("LI-10").comparable, false);
  assert.equal(byId("LI-08").contentNature, "temporal");
  assert.equal(byId("LI-09").contentNature, "evergreen");
  assert.equal(byId("LI-10").multivariable_test, true);
  assert.equal(byId("LI-10").causal_confidence, "low");
  assert.deepEqual(byId("LI-10").changedVariables, ["topic", "format", "hour", "cta"]);
  assert.match(byId("LI-10").snapshots[0]?.notes || "", /3 minuts/);
  assert.equal(byId("LI-16").snapshots[0]?.impressions, 110);
  assert.equal(byId("LI-16").snapshots.at(-1)?.impressions, 267);
  assert.equal(byId("LI-17").snapshots[0]?.impressions, 64);
  assert.equal(byId("LI-17").snapshots.at(-1)?.impressions, 76);
  assert.ok(records.filter((record) => record.platform === "instagram").every((record) => record.snapshots.length === 2));
});

test("sources, conflicts and pending metrics remain explicit", () => {
  assert.ok(records.every((record) => allowedSources.has(record.sourceType)));
  assert.ok(records.flatMap((record) => record.snapshots).every((snapshot) => allowedSources.has(snapshot.sourceType)));
  const roi = records.find((record) => record.id === "LI-01")!;
  assert.equal(roi.publishedAtConflict, true);
  assert.notEqual(roi.publishedAtManual, roi.publishedAtExport);
  assert.match(roi.dataNote || "", /No corregir/);
  assert.equal(records.find((record) => record.id === "LI-07")?.metricsStatus, "pending");
  assert.equal(records.find((record) => record.id === "LI-10")?.metricsStatus, "available");
  assert.equal(records.find((record) => record.id === "FB-BUSINESS-01")?.snapshots.length, 0);
});

test("probable invitations are not counted as leads", () => {
  const snapshots = records.flatMap((record) => record.snapshots);
  const probableInvites = snapshots.reduce(
    (total, snapshot) => total + (snapshot.attributionConfidence === "probable" ? snapshot.connectionRequestsAttributed || 0 : 0),
    0
  );
  const leads = snapshots.reduce((total, snapshot) => total + (snapshot.qualifiedLeads || 0), 0);
  assert.equal(probableInvites, 2);
  assert.equal(leads, 0);
});

test("known LinkedIn publication times include normalized timing metadata", () => {
  const timedLinkedIn = records.filter((record) => record.platform === "linkedin" && record.publishedAt);
  assert.ok(timedLinkedIn.every((record) => record.published_weekday));
  assert.ok(timedLinkedIn.every((record) => typeof record.published_hour === "number"));
  assert.ok(timedLinkedIn.every((record) => typeof record.published_minute === "number"));
  assert.ok(timedLinkedIn.every((record) => record.time_slot || (record.published_hour! >= 10 && record.published_hour! < 12)));
  assert.equal(records.find((record) => record.id === "LI-04")?.time_slot, "early_morning");
});

test("rolling platform windows stay separate from individual post exports", () => {
  const ranking = platformSnapshots.linkedin.rollingRanking20260820;
  assert.equal(ranking.find((item: { contentId?: string }) => item.contentId === "LI-08")?.impressions, 270);
  assert.equal(ranking.find((item: { contentId?: string }) => item.contentId === "LI-09")?.impressions, 226);
  assert.equal(records.find((record) => record.id === "LI-08")?.snapshots.at(-1)?.impressions, 267);
  assert.equal(records.find((record) => record.id === "LI-09")?.snapshots.at(-1)?.impressions, 221);
});

test("aggregate audience views and unavailable Instagram followers are preserved", () => {
  assert.equal(platformSnapshots.linkedin.currentAudienceViews.length, 3);
  assert.equal(platformSnapshots.linkedin.currentAudienceViews[0].inexperiencedPercent, 36);
  assert.equal(platformSnapshots.linkedin.currentAudienceViews[1].inexperiencedPercent, 38);
  assert.equal(platformSnapshots.linkedin.currentAudienceViews[2].inexperiencedPercent, 36);
  const latestInstagram = platformSnapshots.instagram.rolling30DaySnapshots.at(-1);
  assert.equal(latestInstagram.netFollowers, null);
  assert.equal(latestInstagram.netFollowersStatus, "unavailable");
});
