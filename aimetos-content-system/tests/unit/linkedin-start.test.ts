import test from "node:test";
import assert from "node:assert/strict";
import { buildLinkedInStartData } from "../../apps/api/src/server.ts";

const content = [
  { id: "LI-01", platform: "linkedin", title: "Mesurat", topic: "a", status: "published", sourceType: "real_export", snapshots: [{}] },
  { id: "LI-06", platform: "linkedin", title: "Pendent", topic: "b", status: "metrics_pending", sourceType: "pending", snapshots: [] },
  { id: "IG-01", platform: "instagram", title: "Instagram", topic: "c", status: "published", sourceType: "real_manual", snapshots: [{}] }
];

test("manual captures complete the LinkedIn starting state", () => {
  const result = buildLinkedInStartData(content, [{ contentId: "LI-06", sourceType: "real_manual" }]);

  assert.equal(result.metricsComplete, true);
  assert.equal(result.posts.length, 2);
  assert.equal(result.posts[1]?.snapshots, 1);
  assert.equal(result.posts[1]?.sourceType, "real_manual");
  assert.equal(result.posts[1]?.status, "published");
  assert.match(result.reason, /Totes les publicacions/);
});

test("LinkedIn remains incomplete without the missing capture", () => {
  const result = buildLinkedInStartData(content, []);

  assert.equal(result.metricsComplete, false);
  assert.equal(result.posts[1]?.snapshots, 0);
  assert.match(result.nextStep, /LI-06/);
});
