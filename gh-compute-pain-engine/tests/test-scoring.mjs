import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'pain-signals.json'), 'utf8'));

function scoreLead(normalized, classification) {
  if (!classification || classification.is_relevant !== true) {
    return {
      score: 0,
      priority: 'C',
      next_action: 'Conservar como señal; no contactar'
    };
  }

  const haystack = `${normalized.source_title || ''} ${normalized.raw_text || ''} ${classification.pain_signal || ''} ${classification.pain_summary || ''}`.toLowerCase();
  let score = 20;

  if (classification.evidence_strength === 'high') score += 30;
  if (classification.evidence_strength === 'medium') score += 15;

  const categoryScores = {
    performance: 25,
    iterations: 20,
    automation: 20,
    hiring_signal: 10,
    no_clear_pain: 0
  };
  score += categoryScores[classification.pain_category] || 0;

  if (/(rhino|grasshopper|computational design|parametric design|diseño computacional|diseño paramétrico)/i.test(haystack)) score += 10;
  if (/(optimization|optimisation|simulation|facade|fachada|digital fabrication|additive manufacturing|generative design|fabricación digital)/i.test(haystack)) score += 10;
  if (/(slow|crash|freeze|freezes|hours|heavy|large model|batch|multiple variants|automation|lento|bloquea|crashea|horas|pesad[ao]|variantes|automatización)/i.test(haystack)) score += 20;

  score = Math.min(score, 100);
  const priority = score >= 80 ? 'A' : score >= 65 ? 'B' : 'C';
  const next_action = priority === 'A'
    ? 'Revisar empresa y localizar decisor en Sales Navigator en 24 horas'
    : priority === 'B'
      ? 'Validar decisor y evidencia antes de contactar'
      : 'Conservar como señal; no contactar';

  return { score, priority, next_action };
}

for (const fixture of fixtures) {
  const result = scoreLead(fixture.normalized, fixture.classification);
  if (fixture.expectedPriority) {
    assert.equal(result.priority, fixture.expectedPriority, `${fixture.name} priority`);
  }
  if (fixture.expectedNotPriority) {
    assert.notEqual(result.priority, fixture.expectedNotPriority, `${fixture.name} not priority`);
  }
  if (fixture.expectedMinimumScore) {
    assert.ok(result.score >= fixture.expectedMinimumScore, `${fixture.name} minimum score`);
  }
}

console.log('test-scoring: ok');
