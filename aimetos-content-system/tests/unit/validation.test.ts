import test from "node:test";
import assert from "node:assert/strict";
import { validateMetric } from "../../packages/validation/src/schemas.ts";
import metrics from "../fixtures/metrics-import.ts";

test("fixture metrics are valid", () => {
  assert.ok(metrics.every((metric) => validateMetric(metric).ok));
});
