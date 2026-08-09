import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { DataSourceType, RealContentRecord } from "../../packages/shared/src/domain.ts";

const records = JSON.parse(readFileSync(new URL("../../data/fixtures/real-content.json", import.meta.url), "utf8")) as RealContentRecord[];
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
  assert.deepEqual(records.filter((record) => record.platform === "linkedin").map((record) => record.id), ["LI-00", "LI-01", "LI-02", "LI-03", "LI-04", "LI-05", "LI-06", "LI-07"]);
  assert.equal(byId("LI-01").snapshots.length, 3);
  assert.equal(byId("LI-02").snapshots.length, 2);
  assert.equal(byId("LI-03").snapshots.length, 2);
  assert.equal(byId("LI-05").snapshots.length, 2);
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
