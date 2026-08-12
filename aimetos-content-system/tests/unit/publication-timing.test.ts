import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { RealContentRecord } from "../../packages/shared/src/domain.ts";
import {
  analyzePublicationTiming,
  chooseTimingTestStrategy,
  timeSlotFromHour
} from "../../packages/analytics/src/publication-timing.ts";

const records = JSON.parse(
  readFileSync(new URL("../../data/fixtures/real-content.json", import.meta.url), "utf8")
) as RealContentRecord[];

test("time slots follow the configured publication ranges", () => {
  assert.equal(timeSlotFromHour(7), "early_morning");
  assert.equal(timeSlotFromHour(8), "morning");
  assert.equal(timeSlotFromHour(12), "midday");
  assert.equal(timeSlotFromHour(15), "afternoon");
  assert.equal(timeSlotFromHour(17), "evening");
  assert.equal(timeSlotFromHour(10), undefined);
});

test("current timing evidence is insufficient despite repeated morning posts", () => {
  const analysis = analyzePublicationTiming(records);
  const morning = analysis.slots.find((slot) => slot.time_slot === "morning")!;
  const earlyMorning = analysis.slots.find((slot) => slot.time_slot === "early_morning")!;

  assert.equal(analysis.timing_confidence, "insufficient_data");
  assert.equal(analysis.can_claim_best_time, false);
  assert.equal(analysis.comparable_time_slots, 1);
  assert.equal(morning.comparable_24h_posts, 3);
  assert.equal(morning.impressions_24h, 131.67);
  assert.equal(earlyMorning.comparable_24h_posts, 0);
});

test("a new editorial variable keeps timing stable", () => {
  assert.equal(chooseTimingTestStrategy("insufficient_data", true), "maintain_time");
  assert.equal(chooseTimingTestStrategy("insufficient_data", false), "controlled_new_slot_test");
});
