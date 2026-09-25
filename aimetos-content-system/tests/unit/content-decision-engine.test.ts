import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { EditorialFamily, RealContentRecord } from "../../packages/shared/src/domain.ts";
import {
  buildEditorialState,
  findPublishedContent,
  maturityStage,
  type EditorialState
} from "../../packages/core/src/editorial-state.ts";
import {
  buildContentDecision,
  decideWeeklyCadence,
  scoreEditorialCandidate,
  type EditorialCandidate
} from "../../packages/core/src/content-decision-engine.ts";

const NOW = new Date("2026-09-24T13:10:00+02:00");

function record(
  id: string,
  publishedAt: string,
  snapshots: RealContentRecord["snapshots"],
  extra: Partial<RealContentRecord> = {}
): RealContentRecord {
  return {
    id,
    platform: "linkedin",
    title: extra.title || id,
    hook: extra.hook,
    topic: extra.topic || id,
    editorialAngle: extra.editorialAngle || "cas real",
    editorialFamily: extra.editorialFamily || "real_cases",
    format: extra.format || "post_amb_imatge",
    publishedAt,
    status: "published",
    metricsStatus: "available",
    sourceType: "real_export",
    targetCustomer: "PIMEs",
    funnelStage: "MOFU",
    comparable: true,
    snapshots,
    ...extra
  };
}

function candidate(
  id: string,
  family: EditorialFamily = "commercial_signals",
  extra: Partial<EditorialCandidate> = {}
): EditorialCandidate {
  return {
    id,
    title: `Idea ${id}`,
    topic: `Tema ${id}`,
    family,
    real_case: true,
    source: "Cas real",
    authority_fit: 0.85,
    hook: `Hook ${id}`,
    post_copy: `Text ${id}`,
    channel: "linkedin",
    format: "image_post",
    display_format: "Post LinkedIn amb imatge",
    visual_style: "baseline",
    visual_brief: "Visual baseline",
    image_prompt: "Prompt",
    cta: "Pregunta?",
    target_customer: "PIMEs",
    concrete_problem: "Problema",
    funnel_stage: "MOFU",
    objective: "qualified_conversation",
    learning_objective: "catalog_validation",
    expected_signal: "Conversa qualificada",
    metrics_to_watch: ["Comentaris"],
    ...extra
  };
}

function state(records: RealContentRecord[], extra = {}): EditorialState {
  return buildEditorialState({ records, now: NOW, ...extra });
}

test("freshness precedence selects the newest valid snapshot without deleting history", () => {
  const post = record("FRESH", "2026-09-10T08:40:00+02:00", [
    { capturedAt: "2026-09-24T10:00:00+02:00", period: "7d", impressions: 267, sourceType: "real_export" },
    { capturedAt: "2026-09-18T10:00:00+02:00", period: "24h", impressions: 110, sourceType: "real_export" }
  ]);
  const editorialState = state([post]);
  assert.equal(editorialState.recent_posts[0].latest_snapshot?.impressions, 267);
  assert.equal(editorialState.recent_posts[0].snapshots.length, 2);
  assert.match(editorialState.data_quality_warnings.join(" "), /freshness precedence/);
});

test("published guard blocks exact and near-duplicate ideas", () => {
  const published = record("PUB", "2026-09-01T08:40:00+02:00", [], {
    title: "Antes de automatizar un proceso, mide estas 3 pérdidas invisibles",
    topic: "Pérdidas invisibles antes de automatizar",
    editorialFamily: "real_cases"
  });
  const match = findPublishedContent({
    title: "Antes de automatizar, mide las 3 pérdidas invisibles del proceso",
    topic: "Pérdidas invisibles antes de automatizar",
    family: "real_cases"
  }, [published]);
  assert.equal(match?.record.id, "PUB");
});

test("maturity stages protect 24h, 72h and 7d windows", () => {
  assert.equal(maturityStage(record("EARLY", "2026-09-24T08:00:00+02:00", []), NOW), "EARLY_SIGNAL");
  assert.equal(maturityStage(record("PROV", "2026-09-23T08:00:00+02:00", []), NOW), "PROVISIONAL");
  assert.equal(maturityStage(record("MAT", "2026-09-20T08:00:00+02:00", []), NOW), "MATURING");
  assert.equal(maturityStage(record("COMP", "2026-09-17T08:00:00+02:00", []), NOW), "COMPARABLE");
});

test("timing remains insufficient until two slots have comparable samples", () => {
  const records = [0, 1, 2].map((index) => record(
    `M${index}`,
    `2026-09-${10 + index}T08:40:00+02:00`,
    [{ period: "24h", impressions: 100 + index, reach: 60, sourceType: "real_export" }],
    { time_slot: "morning" }
  ));
  records.push(record("E0", "2026-09-14T17:58:00+02:00", [
    { period: "24h", impressions: 76, reach: 38, sourceType: "real_export" }
  ], { time_slot: "evening" }));
  const editorialState = state(records);
  assert.equal(editorialState.timing_confidence, "early_signal");
  assert.equal(editorialState.time_slot_samples.morning, 3);
  assert.equal(editorialState.time_slot_samples.evening, 1);
  assert.match(editorialState.timing_reason, /senyal inicial/);
});

test("repetition and recent-family penalties lower candidate priority", () => {
  const recent = [
    record("R1", "2026-09-22T08:40:00+02:00", [], { hook: "Una aprobación no debería bloquearse", editorialFamily: "commercial_signals" }),
    record("R2", "2026-09-20T08:40:00+02:00", [], { hook: "El sistema prepara. La persona decide.", editorialFamily: "commercial_signals" })
  ];
  const editorialState = state(recent);
  const repeated = scoreEditorialCandidate(candidate("repeated", "commercial_signals", {
    hook: "Un proceso no debería depender de un correo",
    post_copy: "El sistema prepara. La persona decide."
  }), editorialState, recent);
  const diverse = scoreEditorialCandidate(candidate("diverse", "integrations_data", {
    hook: "Tres fuentes, una vista operativa",
    post_copy: "Integra datos y detecta excepciones."
  }), editorialState, recent);
  assert.ok(repeated.score < diverse.score);
  assert.ok(repeated.penalties.some((reason) => /família|fórmula/.test(reason)));
});

test("the experiment changes one primary variable and keeps explicit controls", () => {
  const decision = buildContentDecision({ state: state([]), records: [] });
  assert.equal(decision.experiment.primary_variable, "topic");
  assert.ok(decision.experiment.controls.some((control) => control.includes("08:40")));
  assert.deepEqual(decision.experiment.measurement_windows, ["24h: senyal inicial", "72h: lectura provisional", "7d: comparació útil"]);
});

test("weekly cadence supports 0, 1 and 2 posts instead of hardcoding two", () => {
  assert.equal(decideWeeklyCadence([], false), 0);
  assert.equal(decideWeeklyCadence([{ score: 75, status: "eligible", family: "real_cases" }], false), 1);
  assert.equal(decideWeeklyCadence([
    { score: 90, status: "eligible", family: "real_cases" },
    { score: 86, status: "eligible", family: "commercial_signals" }
  ], false), 2);
  assert.equal(decideWeeklyCadence([
    { score: 90, status: "eligible", family: "real_cases" },
    { score: 86, status: "eligible", family: "commercial_signals" }
  ], true), 1);
});

test("a real case outranks an otherwise equivalent hypothetical case", () => {
  const editorialState = state([]);
  const real = scoreEditorialCandidate(candidate("real"), editorialState, []);
  const hypothetical = scoreEditorialCandidate(candidate("hypothetical", "commercial_signals", {
    real_case: false,
    source: "Exemple genèric"
  }), editorialState, []);
  assert.ok(real.score > hypothetical.score);
});

test("PM uses the mature 267 snapshot and approvals cannot condemn the afternoon slot", () => {
  const records = JSON.parse(readFileSync(new URL("../../data/fixtures/real-content.json", import.meta.url), "utf8")) as RealContentRecord[];
  const platformSnapshots = JSON.parse(readFileSync(new URL("../../data/fixtures/platform-snapshots.json", import.meta.url), "utf8"));
  const editorialState = buildEditorialState({ records, platformSnapshots, now: NOW });
  const pm = editorialState.recent_posts.find((post) => post.id === "LI-16");
  const approvals = editorialState.recent_posts.find((post) => post.id === "LI-17");
  assert.equal(pm?.latest_snapshot?.impressions, 267);
  assert.equal(pm?.maturity, "COMPARABLE");
  assert.equal(approvals?.latest_snapshot?.impressions, 76);
  assert.equal(approvals?.maturity, "PROVISIONAL");
  assert.notEqual(editorialState.timing_confidence, "strong_pattern");
  assert.match(editorialState.data_quality_warnings.join(" "), /no permet concloure|no una hora guanyadora/i);
});

test("the current decision is new, real, auditable and carries data-quality warnings", () => {
  const records = JSON.parse(readFileSync(new URL("../../data/fixtures/real-content.json", import.meta.url), "utf8")) as RealContentRecord[];
  const platformSnapshots = JSON.parse(readFileSync(new URL("../../data/fixtures/platform-snapshots.json", import.meta.url), "utf8"));
  const editorialState = buildEditorialState({ records, platformSnapshots, now: NOW });
  const decision = buildContentDecision({ state: editorialState, records });
  assert.equal(decision.candidate_id, "commercial-signals-job-offers");
  assert.equal(decision.real_case, true);
  assert.equal(decision.weekly_cadence, 1);
  assert.equal(findPublishedContent({ title: decision.hook, topic: decision.topic, family: decision.family }, records), undefined);
  assert.ok(decision.warnings.length > 0);
  assert.equal(decision.confidence.timing, "early_signal");
});
