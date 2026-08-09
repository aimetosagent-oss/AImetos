import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { EditorialCalendar } from "../../packages/shared/src/domain.ts";
import { loadConfig } from "../../packages/config/src/env.ts";
import { analyzePerformance } from "../../packages/analytics/src/performance.ts";
import { generateFiveIdeas, selectBestIdeas } from "../../packages/strategy/src/ideation.ts";
import { resolveTemporalContext } from "../../packages/strategy/src/editorial-calendar.ts";
import metrics from "../fixtures/metrics-import.ts";

const calendar = JSON.parse(readFileSync(new URL("../../config/editorial-calendar.json", import.meta.url), "utf8")) as EditorialCalendar;

test("August context applies a bounded temporal bonus", () => {
  const context = resolveTemporalContext(calendar, new Date("2026-08-09T10:00:00+02:00"));
  const ideas = generateFiveIdeas(analyzePerformance(metrics, loadConfig()), "normal", context);
  const august = ideas.find((idea) => idea.id === "idea_august_process_stress")!;
  assert.equal(context.badge, "Context temporal: Vacances d'agost");
  assert.ok(august.temporalBonus > 0 && august.temporalBonus <= 0.65);
});

test("expired seasonal idea cannot be selected", () => {
  const afterExpiry = new Date("2026-09-02T10:00:00+02:00");
  const context = resolveTemporalContext(calendar, afterExpiry);
  const ideas = generateFiveIdeas(analyzePerformance(metrics, loadConfig()), "normal", context);
  const selected = selectBestIdeas(ideas, loadConfig(), afterExpiry);
  assert.equal(context.activeEvents.length, 0);
  assert.equal(selected.some((idea) => idea.id === "idea_august_process_stress"), false);
});
