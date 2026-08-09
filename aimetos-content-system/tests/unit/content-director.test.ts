import test from "node:test";
import assert from "node:assert/strict";
import { createChatProvider, loadContentDirectorInstructions, type ContentDirectorContext } from "../../packages/core/src/content-director.ts";

const context: ContentDirectorContext = {
  recommendedIdea: "Agosto es una prueba de estrés para tus procesos.",
  recommendationReason: "Varietat editorial i context temporal.",
  confidence: "Patró en desenvolupament",
  comparablePosts: 5,
  temporalContext: "Context temporal: Vacances d'agost",
  executiveReading: ["ROI lidera abast.", "El model híbrid genera conversa."],
  commercialSignals: { leads: 0, meetings: 0, probableAttributedConnections: 2 },
  dataConflicts: [{ contentId: "LI-01", note: "Data discrepant." }],
  pendingContentIds: ["LI-06", "LI-07", "FB-BUSINESS-01"],
  snapshotInventory: [{ contentId: "LI-01", count: 3, latestLabel: "latest_available" }],
  marketSignals: ["Saturació d'agents genèrics"],
  editorialMemory: ["Integracions i dades disperses"],
  candidateIdeas: [{ title: "Agosto es una prueba de estrés para tus procesos.", family: "processes_operations", recommended: true }]
};

test("mock content director stays grounded in dashboard context", async () => {
  const provider = createChatProvider("mock");
  const reply = await provider.reply([{ role: "user", content: "Quins resultats comercials tenim?" }], context);
  assert.equal(provider.name, "mock");
  assert.match(reply, /0 leads/);
  assert.match(reply, /no compten com a leads/);
});

test("OpenAI provider is prepared but performs no external call", async () => {
  const provider = createChatProvider("openai");
  assert.match(loadContentDirectorInstructions(), /No inventis mètriques/);
  await assert.rejects(() => provider.reply([{ role: "user", content: "Hola" }], context), /desactivat/);
});
