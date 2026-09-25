import type { EditorialFamily, RealContentRecord, TestVariable } from "../../shared/src/domain.ts";
import {
  DEFAULT_CANDIDATE_TOPICS,
  findPublishedContent,
  normalizeEditorialText,
  type CandidateTopic,
  type DecisionConfidence,
  type EditorialState
} from "./editorial-state.ts";

export type LearningObjective =
  | "reach"
  | "qualified_conversation"
  | "profile_visits"
  | "saves"
  | "sends"
  | "shares"
  | "outside_network"
  | "audience_quality"
  | "commercial_signal"
  | "catalog_validation";

export type EditorialCandidate = CandidateTopic & {
  hook: string;
  post_copy: string;
  channel: "linkedin";
  format: "image_post" | "document_carousel" | "short_native_video" | "text_post";
  display_format: string;
  visual_style: string;
  visual_brief: string;
  image_prompt: string;
  cta: string;
  target_customer: string;
  concrete_problem: string;
  funnel_stage: "TOFU" | "MOFU" | "BOFU";
  objective: LearningObjective;
  learning_objective: LearningObjective;
  expected_signal: string;
  metrics_to_watch: string[];
};

export type ScoredCandidate = EditorialCandidate & {
  score: number;
  status: "eligible" | "already_published" | "excluded_by_user";
  score_reasons: string[];
  penalties: string[];
  published_match?: { post_id: string; title: string; similarity: number };
};

export type ContentDecision = {
  decision_id: string;
  generated_at: string;
  publish: boolean;
  weekly_cadence: 0 | 1 | 2;
  reason_to_publish: string;
  objective: LearningObjective;
  learning_objective: LearningObjective;
  candidate_id: string;
  topic: string;
  family: EditorialFamily;
  real_case: boolean;
  authority_fit: number;
  hook: string;
  post_copy: string;
  channel: "linkedin";
  recommended_date: string;
  recommended_time: string;
  time_slot: "morning";
  timing_label: "Hora recomanada actual" | "Millor hora per publicar";
  format: EditorialCandidate["format"];
  display_format: string;
  visual_style: string;
  visual_brief: string;
  image_prompt: string;
  cta: string;
  experiment: {
    hypothesis: string;
    primary_variable: TestVariable;
    controls: string[];
    confounders: string[];
    expected_signal: string;
    measurement_windows: string[];
  };
  confidence: {
    content: DecisionConfidence;
    timing: DecisionConfidence;
    format: DecisionConfidence;
    visual: DecisionConfidence;
  };
  evidence: Array<{ post_id: string; reason: string }>;
  metrics_to_watch: string[];
  validation: { "24h": string; "72h": string; "7d": string };
  alternatives: Array<{
    candidate_id: string;
    title: string;
    family: EditorialFamily;
    format: string;
    status: ScoredCandidate["status"];
    score: number;
    reason: string;
  }>;
  warnings: string[];
  constraints: string[];
};

export type BuildContentDecisionInput = {
  state: EditorialState;
  records: RealContentRecord[];
  candidates?: EditorialCandidate[];
  excludedCandidateIds?: string[];
};

const COMMON_METRICS = [
  "Impressions a 24 h, 72 h i 7 dies",
  "Membres assolits",
  "Visites al perfil",
  "Comentaris",
  "Guardats",
  "Enviaments",
  "Comparticions",
  "Qualitat de l'audiència",
  "Leads i reunions confirmats"
];

export const DEFAULT_EDITORIAL_CANDIDATES: EditorialCandidate[] = [
  {
    ...DEFAULT_CANDIDATE_TOPICS[0],
    hook: "Una oferta de empleo también puede ser una señal comercial.",
    post_copy: "Una oferta de empleo también puede ser una señal comercial.\n\nCuando una empresa publica una vacante puede estar creciendo, cubriendo una urgencia operativa o intentando resolver una falta de capacidad. No demuestra que exista una oportunidad, pero sí aporta más contexto que prospectar completamente a ciegas.\n\nEn un caso real estamos utilizando un sistema que monitoriza fuentes públicas, identifica la empresa, filtra el tipo de señal y prepara una lista priorizada. Después, una persona valida si hay encaje y decide cómo iniciar la conversación.\n\nNo se trata de hacer más prospección. Se trata de hacerla con más criterio.\n\n¿Qué señales utilizas hoy para decidir a qué empresas merece la pena prestar atención?",
    channel: "linkedin",
    format: "image_post",
    display_format: "Post LinkedIn amb imatge",
    visual_style: "Esquema corporatiu clar, una sola idea i estil visual baseline d'AImetos",
    visual_brief: "Flux de quatre passos: oferta publicada, senyal detectada, empresa prioritzada i validació humana. Sense promeses de leads. Logo AImetos original en petit.",
    image_prompt: "Crea una imagen profesional para LinkedIn, formato 1200x627, estilo de consultoría tecnológica B2B. Titular: 'Una oferta de empleo también puede ser una señal comercial'. Representa un flujo limpio de cuatro pasos: oferta pública, señal detectada, empresa priorizada y validación humana. Mensaje secundario: 'Más criterio, no más prospección'. Paleta blanca, verde petróleo, azul y gris, coherente con las piezas actuales de AImetos para mantener estable la variable visual. Incluye el logo AImetos original, sin modificarlo, en pequeño en la esquina superior derecha. Sin personas, robots, estética de scraping ni promesas de leads.",
    cta: "¿Qué señales utilizas hoy para decidir a qué empresas merece la pena prestar atención?",
    target_customer: "Responsables comercials i d'operacions de PIMEs B2B",
    concrete_problem: "Prospecció sense context sobre quines empreses tenen una necessitat observable",
    funnel_stage: "MOFU",
    objective: "qualified_conversation",
    learning_objective: "catalog_validation",
    expected_signal: "Comentaris o visites al perfil de perfils comercials i decisors que validin el cas real.",
    metrics_to_watch: COMMON_METRICS
  },
  {
    ...DEFAULT_CANDIDATE_TOPICS[1],
    hook: "Un dashboard útil no termina en el dato. Empieza en la siguiente decisión.",
    post_copy: "Un dashboard útil no termina en el dato. Empieza en la siguiente decisión.\n\nEn AImetos estamos probando un flujo que compara el histórico, separa señales de patrones y propone qué validar después. El objetivo no es añadir otro panel: es reducir el trabajo manual entre medir y decidir.\n\nLa siguiente prueba será mostrar el producto real, no otra infografía.\n\n¿Qué decisión debería ayudarte a tomar un dashboard que hoy todavía haces a mano?",
    channel: "linkedin",
    format: "short_native_video",
    display_format: "Vídeo curt LinkedIn",
    visual_style: "Gravació de pantalla real, sense decoració afegida",
    visual_brief: "Screen recording curt del dashboard real: dades, comparació, patró, recomanació i validació. Logo ja present a la interfície.",
    image_prompt: "No generar una infografía. Preparar una portada 1200x627 para un vídeo de producto real con el texto 'Del dato a la siguiente decisión', una captura legible del dashboard AImetos y el logo original en pequeño.",
    cta: "¿Qué decisión debería ayudarte a tomar un dashboard que hoy todavía haces a mano?",
    target_customer: "Equips de màrqueting tècnic i responsables de negoci",
    concrete_problem: "Dashboards que mostren dades però no redueixen el treball de decisió",
    funnel_stage: "MOFU",
    objective: "profile_visits",
    learning_objective: "catalog_validation",
    expected_signal: "Retenció del vídeo, visites al perfil i preguntes sobre el producte real.",
    metrics_to_watch: [...COMMON_METRICS, "Retenció del vídeo"]
  },
  {
    ...DEFAULT_CANDIDATE_TOPICS[2],
    hook: "Cuando dos fuentes discrepan, el sistema no debería fingir certeza.",
    post_copy: "Cuando dos fuentes discrepan, el sistema no debería fingir certeza.\n\nEn Project Management, completar información no es lo mismo que gobernar la incertidumbre. Un sistema útil puede detectar la contradicción, mostrar qué fuentes no coinciden, pedir revisión y señalar qué evidencia falta.\n\nLa decisión sigue necesitando criterio. La diferencia es que la excepción deja de estar escondida.\n\n¿Cómo gestionáis hoy una actualización contradictoria entre dos fuentes?",
    channel: "linkedin",
    format: "document_carousel",
    display_format: "Document LinkedIn",
    visual_style: "Framework guardable de contradicció, evidència i decisió",
    visual_brief: "Mini-guia de tres passos sobre detectar, fer visible i escalar una contradicció. Logo AImetos original en petit.",
    image_prompt: "Crea un documento LinkedIn de 4 páginas, claro y guardable, sobre cómo tratar información contradictoria en Project Management. No prometas resolver automáticamente la realidad. Paleta AImetos y logo original pequeño.",
    cta: "¿Cómo gestionáis hoy una actualización contradictoria entre dos fuentes?",
    target_customer: "Project Managers i responsables d'operacions",
    concrete_problem: "Fonts incompletes, desactualitzades o contradictòries",
    funnel_stage: "MOFU",
    objective: "saves",
    learning_objective: "shares",
    expected_signal: "Guardats i comentaris de professionals que reconeguin el problema.",
    metrics_to_watch: COMMON_METRICS
  },
  {
    ...DEFAULT_CANDIDATE_TOPICS[3],
    hook: "Tres excepciones que una automatización de facturas debe hacer visibles.",
    post_copy: "Automatizar facturas no consiste solo en copiar datos más rápido.\n\nHay tres excepciones que el sistema debería hacer visibles: un proveedor que no coincide, un importe fuera de tolerancia y un documento incompleto.\n\nLa automatización prepara y señala. Una persona revisa la excepción.\n\n¿Cuál de estas incidencias os roba más tiempo hoy?",
    channel: "linkedin",
    format: "document_carousel",
    display_format: "Carrusel LinkedIn",
    visual_style: "Checklist guardable de tres excepcions",
    visual_brief: "Tres excepcions de factures en un document breu, amb jerarquia clara i logo AImetos original en petit.",
    image_prompt: "Crea un carrusel LinkedIn profesional de 4 páginas con tres excepciones en automatización de facturas: proveedor, importe y documento incompleto. Estilo consultoría tecnológica B2B, logo AImetos original pequeño.",
    cta: "¿Cuál de estas incidencias os roba más tiempo hoy?",
    target_customer: "PIMEs amb administració documental manual",
    concrete_problem: "Excepcions ocultes en factures i documents",
    funnel_stage: "MOFU",
    objective: "saves",
    learning_objective: "shares",
    expected_signal: "Guardats i enviaments d'una checklist aplicable.",
    metrics_to_watch: COMMON_METRICS
  }
];

function narrativePenalty(candidate: EditorialCandidate, recentHooks: string[]): { points: number; reason?: string } {
  const patterns = ["no deberia", "la persona decide", "el sistema prepara", "menos "];
  const normalizedCandidate = normalizeEditorialText(`${candidate.hook} ${candidate.post_copy}`);
  const reused = patterns.filter((pattern) =>
    normalizedCandidate.includes(normalizeEditorialText(pattern)) &&
    recentHooks.some((hook) => normalizeEditorialText(hook).includes(normalizeEditorialText(pattern)))
  );
  return reused.length > 0
    ? { points: Math.min(18, reused.length * 7), reason: `Repeteix una fórmula narrativa recent: ${reused.join(", ")}.` }
    : { points: 0 };
}

export function scoreEditorialCandidate(
  candidate: EditorialCandidate,
  state: EditorialState,
  records: RealContentRecord[],
  excludedCandidateIds: string[] = []
): ScoredCandidate {
  const match = findPublishedContent(candidate, records);
  if (match) {
    return {
      ...candidate,
      score: 0,
      status: "already_published",
      score_reasons: [],
      penalties: ["La idea coincideix amb contingut ja publicat."],
      published_match: { post_id: match.record.id, title: match.record.title, similarity: match.similarity }
    };
  }
  if (excludedCandidateIds.includes(candidate.id)) {
    return { ...candidate, score: 0, status: "excluded_by_user", score_reasons: [], penalties: ["Exclosa explícitament per l'usuari."] };
  }

  const recent = state.recent_posts.slice(0, 4);
  const recentFamilyCount = recent.filter((post) => post.family === candidate.family).length;
  const sameAsLatest = recent[0]?.family === candidate.family;
  const narrative = narrativePenalty(candidate, recent.map((post) => post.hook));
  let score = 42;
  const reasons: string[] = [];
  const penalties: string[] = [];

  if (candidate.real_case) {
    score += 20;
    reasons.push("Parteix d'un cas, producte o problema real.");
  }
  score += Math.round(candidate.authority_fit * 18);
  reasons.push(`Authority fit ${Math.round(candidate.authority_fit * 100)}%.`);
  if (recentFamilyCount === 0) {
    score += 14;
    reasons.push("Aporta diversitat respecte de les últimes quatre publicacions.");
  }
  if (sameAsLatest) {
    score -= 24;
    penalties.push("Repeteix la família de la publicació més recent.");
  }
  if (recentFamilyCount >= 2) {
    score -= 22;
    penalties.push("La família ja apareix almenys dues vegades en les últimes quatre publicacions.");
  }
  if (narrative.points > 0) {
    score -= narrative.points;
    penalties.push(narrative.reason!);
  }
  if (state.propagation_metrics.bottleneck && ["document_carousel"].includes(candidate.format)) {
    score += 7;
    reasons.push("El format pot provar guardats o enviaments, que avui són un coll d'ampolla.");
  }
  if (candidate.id === "commercial-signals-job-offers") {
    score += 10;
    reasons.push("Obre una família comercial real sense utilitzar narrativa de lead scraping.");
  }

  return {
    ...candidate,
    score: Math.max(0, Math.min(100, score)),
    status: "eligible",
    score_reasons: reasons,
    penalties
  };
}

export function decideWeeklyCadence(
  candidates: Array<Pick<ScoredCandidate, "score" | "status" | "family">>,
  activeExperiment = false
): 0 | 1 | 2 {
  const eligible = candidates.filter((candidate) => candidate.status === "eligible" && candidate.score >= 65);
  if (eligible.length === 0) return 0;
  if (activeExperiment) return 1;
  const strong = eligible.filter((candidate) => candidate.score >= 82);
  if (strong.length >= 2 && strong[0].family !== strong[1].family && strong[0].score - strong[1].score <= 8) return 2;
  return 1;
}

function nextTuesday(from: string): string {
  const date = new Date(`${from}T12:00:00Z`);
  const day = date.getUTCDay();
  let delta = (2 - day + 7) % 7;
  if (delta === 0) delta = 7;
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function timingConfidence(value: EditorialState["timing_confidence"]): DecisionConfidence {
  if (value === "validated_pattern") return "strong_pattern";
  return value;
}

export function buildContentDecision({
  state,
  records,
  candidates = DEFAULT_EDITORIAL_CANDIDATES,
  excludedCandidateIds = []
}: BuildContentDecisionInput): ContentDecision {
  const scored = candidates
    .map((candidate) => scoreEditorialCandidate(candidate, state, records, excludedCandidateIds))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const eligible = scored.filter((candidate) => candidate.status === "eligible");
  const selected = eligible[0];
  const cadence = decideWeeklyCadence(scored, Boolean(state.current_experiment && state.current_experiment.status !== "completed"));
  const fallback = candidates[0];
  const primary = selected || fallback;
  const publish = Boolean(selected && cadence > 0 && selected.score >= 65);
  const warnings = [...state.data_quality_warnings];
  if (state.current_experiment?.primary_variable === "time") {
    warnings.push("El post d'aprovacions és el primer test 17–20; no permet afirmar que la tarda sigui millor o pitjor.");
  }
  if (!publish) warnings.push("Cap candidata supera el llindar mínim de valor i aprenentatge aquesta setmana.");

  const evidence: ContentDecision["evidence"] = [];
  if (state.recent_posts.some((post) => post.id === "LI-16")) {
    evidence.push({
      post_id: "LI-16",
      reason: "Project Management va passar de 110 impressions inicials a 267 a 7 dies, amb 3 comentaris i 1 guardat: no s'ha de sentenciar a 24 h."
    });
  }
  if (state.recent_posts.some((post) => post.id === "LI-17")) {
    evidence.push({
      post_id: "LI-17",
      reason: "Aprovacions té 76 impressions a ~43 h i és només el primer datapoint de tarda; el timing continua sense validar."
    });
  }
  evidence.push({
    post_id: "AGG-2026-09-24",
    reason: `${state.propagation_metrics.shares} comparticions, ${state.propagation_metrics.saves} guardat i ${state.propagation_metrics.sends} enviament: convé aprendre amb casos útils sense perseguir només impressions.`
  });

  return {
    decision_id: `decision_${state.current_date}_${primary.id}`,
    generated_at: `${state.current_date}T${state.current_time}`,
    publish,
    weekly_cadence: cadence,
    reason_to_publish: publish
      ? "És el millor equilibri actual entre valor comercial, cas real, diversitat editorial i aprenentatge. Obre una família nova sense repetir Project Management, aprovacions ni la fórmula genèrica de criteri humà."
      : "Aquesta setmana és preferible no publicar: cap candidata aporta prou valor o aprenentatge net.",
    objective: primary.objective,
    learning_objective: primary.learning_objective,
    candidate_id: primary.id,
    topic: primary.topic,
    family: primary.family,
    real_case: primary.real_case,
    authority_fit: primary.authority_fit,
    hook: primary.hook,
    post_copy: primary.post_copy,
    channel: "linkedin",
    recommended_date: nextTuesday(state.current_date),
    recommended_time: "08:40",
    time_slot: "morning",
    timing_label: ["moderate_evidence", "strong_pattern"].includes(timingConfidence(state.timing_confidence))
      ? "Millor hora per publicar"
      : "Hora recomanada actual",
    format: primary.format,
    display_format: primary.display_format,
    visual_style: primary.visual_style,
    visual_brief: primary.visual_brief,
    image_prompt: primary.image_prompt,
    cta: primary.cta,
    experiment: {
      hypothesis: "Un cas comercial real basat en una necessitat observable generarà més conversa qualificada que un exemple genèric, sense necessitat d'augmentar el volum de prospecció.",
      primary_variable: "topic",
      controls: [
        "Canal: LinkedIn",
        "Franja baseline: 08–10",
        "Hora: 08:40",
        "Format baseline: post amb una imatge",
        "Estil visual corporatiu actual",
        "CTA suau amb una sola pregunta"
      ],
      confounders: ["Variació orgànica de distribució i composició de l'audiència"],
      expected_signal: primary.expected_signal,
      measurement_windows: ["24h: senyal inicial", "72h: lectura provisional", "7d: comparació útil"]
    },
    confidence: {
      content: state.content_confidence,
      timing: timingConfidence(state.timing_confidence),
      format: state.format_confidence,
      visual: state.visual_confidence
    },
    evidence,
    metrics_to_watch: primary.metrics_to_watch,
    validation: {
      "24h": "Registrar el senyal inicial sense declarar guanyador.",
      "72h": "Comparar la trajectòria amb snapshots equivalents i revisar conversa i perfil.",
      "7d": "Decidir si el cas comercial queda validat, s'ajusta o es descarta."
    },
    alternatives: scored
      .filter((candidate) => candidate.id !== primary.id)
      .slice(0, 3)
      .map((candidate) => ({
        candidate_id: candidate.id,
        title: candidate.title,
        family: candidate.family,
        format: candidate.display_format,
        status: candidate.status,
        score: candidate.score,
        reason: candidate.status === "already_published"
          ? `Ja publicat com ${candidate.published_match?.post_id}.`
          : candidate.penalties[0] || candidate.score_reasons[0] || "Alternativa disponible per debatre."
      })),
    warnings,
    constraints: [
      "No alterar mètriques, dates, estats publicats ni confiança de mostra amb OpenAI.",
      "No canviar tema, format, visual i hora simultàniament si es pot evitar.",
      "No considerar una invitació o visita al perfil com a lead confirmat."
    ]
  };
}
