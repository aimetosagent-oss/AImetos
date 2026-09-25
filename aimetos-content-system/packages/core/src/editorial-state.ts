import type {
  EditorialFamily,
  EditorialMemoryItem,
  MarketSignal,
  MetricSnapshot,
  PublicationTimeSlot,
  RealContentRecord,
  TestVariable,
  TimingConfidence
} from "../../shared/src/domain.ts";
import { newestValidSnapshot } from "../../analytics/src/business-content.ts";
import { analyzePublicationTiming } from "../../analytics/src/publication-timing.ts";

export type DecisionConfidence =
  | "insufficient_data"
  | "early_signal"
  | "developing_pattern"
  | "moderate_evidence"
  | "strong_pattern";

export type MaturityStage = "EARLY_SIGNAL" | "PROVISIONAL" | "MATURING" | "COMPARABLE" | "UNKNOWN";

export type EditorialExperiment = {
  id: string;
  source: "published_post" | "user_approved_decision";
  status: "active" | "planned" | "completed";
  hypothesis: string;
  primary_variable: TestVariable;
  control_variables: string[];
  confounders: string[];
  expected_signal: string;
  measurement_windows: string[];
  content_id?: string;
  decision_id?: string;
  started_at?: string;
};

export type EditorialControlState = {
  currentExperiment?: EditorialExperiment;
  previousExperiments?: EditorialExperiment[];
  excludedCandidateIds?: string[];
};

export type CandidateTopic = {
  id: string;
  title: string;
  topic: string;
  family: EditorialFamily;
  real_case: boolean;
  source: string;
  authority_fit: number;
};

export type EditorialPostState = {
  id: string;
  title: string;
  hook: string;
  topic: string;
  family: EditorialFamily;
  published_at?: string;
  maturity: MaturityStage;
  age_hours?: number;
  format: string;
  visual_style?: string;
  cta?: string;
  time_slot?: PublicationTimeSlot;
  snapshots: MetricSnapshot[];
  latest_snapshot?: MetricSnapshot;
  comparable: boolean;
};

export type PlatformSnapshots = {
  dataCutoff?: string;
  linkedin?: {
    rolling28DaySnapshots?: Array<Record<string, unknown>>;
    rolling90DaySnapshots?: Array<Record<string, unknown>>;
    currentAudienceViews?: Array<Record<string, unknown>>;
    profileDiscovery?: Record<string, unknown>;
  };
};

export type EditorialState = {
  current_date: string;
  current_time: string;
  timezone: string;
  recent_posts: EditorialPostState[];
  mature_posts: EditorialPostState[];
  last_24h: string[];
  last_72h: string[];
  last_7d: string[];
  last_30d: string[];
  last_90d: string[];
  published_topics: string[];
  published_hooks: string[];
  editorial_families: EditorialFamily[];
  recent_formats: string[];
  recent_visual_styles: string[];
  recent_ctas: string[];
  time_slots: ReturnType<typeof analyzePublicationTiming>["slots"];
  time_slot_samples: Record<PublicationTimeSlot, number>;
  timing_confidence: TimingConfidence;
  timing_reason: string;
  timing_baseline: PublicationTimeSlot | null;
  content_patterns: Array<{
    id: string;
    label: string;
    confidence: DecisionConfidence;
    evidence: string[];
  }>;
  pattern_confidence: DecisionConfidence;
  content_confidence: DecisionConfidence;
  format_confidence: DecisionConfidence;
  visual_confidence: DecisionConfidence;
  current_experiment?: EditorialExperiment;
  previous_experiments: EditorialExperiment[];
  audience_summary: {
    inexperienced_percent?: number;
    location?: string;
    company_size?: string;
    sector?: string;
    company?: string;
    role?: string;
    note: string;
  };
  propagation_metrics: {
    shares: number;
    saves: number;
    sends: number;
    out_of_network_percent: number;
    bottleneck: boolean;
  };
  commercial_signals: {
    profile_visits: number;
    connection_requests: number;
    messages: number;
    leads: number;
    meetings: number;
    confirmed_commercial_result: boolean;
  };
  profile_visits: number;
  followers: number;
  leads: number;
  meetings: number;
  candidate_topics: CandidateTopic[];
  real_use_cases_available: Array<{
    id: string;
    label: string;
    family: EditorialFamily;
    authority_fit: number;
  }>;
  data_quality_warnings: string[];
  market_signals: MarketSignal[];
  editorial_memory: EditorialMemoryItem[];
};

export type BuildEditorialStateInput = {
  records: RealContentRecord[];
  platformSnapshots?: PlatformSnapshots;
  marketSignals?: MarketSignal[];
  editorialMemory?: EditorialMemoryItem[];
  controlState?: EditorialControlState;
  candidateTopics?: CandidateTopic[];
  now?: Date;
  timezone?: string;
};

const REAL_USE_CASES: EditorialState["real_use_cases_available"] = [
  { id: "email-triage", label: "Email triage", family: "processes_operations", authority_fit: 0.82 },
  { id: "commercial-follow-up", label: "Commercial follow-up", family: "commercial_signals", authority_fit: 0.85 },
  { id: "reporting", label: "Reporting", family: "dashboards_measurement", authority_fit: 0.86 },
  { id: "invoices-documents", label: "Invoices and documents", family: "processes_operations", authority_fit: 0.82 },
  { id: "project-management", label: "Project Management", family: "project_management_automation", authority_fit: 0.96 },
  { id: "approvals", label: "Approvals", family: "human_criterion_governance", authority_fit: 0.86 },
  { id: "job-offer-signals", label: "Commercial signals from job offers", family: "commercial_signals", authority_fit: 0.9 }
];

export const DEFAULT_CANDIDATE_TOPICS: CandidateTopic[] = [
  {
    id: "commercial-signals-job-offers",
    title: "Una oferta de empleo también puede ser una señal comercial",
    topic: "Detección de necesidades empresariales a partir de ofertas de empleo",
    family: "commercial_signals",
    real_case: true,
    source: "Workflow real treballat amb un client",
    authority_fit: 0.9
  },
  {
    id: "dashboard-real-demo",
    title: "De los datos a la siguiente decisión: una demo real del dashboard",
    topic: "Content Decision Engine i decisió posterior a les mètriques",
    family: "dashboards_measurement",
    real_case: true,
    source: "Producte real AImetos",
    authority_fit: 0.92
  },
  {
    id: "pm-uncertainty-governance",
    title: "Cuando dos fuentes discrepan, el sistema no debería fingir certeza",
    topic: "Governança de dades contradictòries en Project Management",
    family: "project_management_automation",
    real_case: true,
    source: "Comentari real al post de Project Management",
    authority_fit: 0.96
  },
  {
    id: "invoice-exceptions",
    title: "Tres excepciones que una automatización de facturas debe hacer visibles",
    topic: "Excepcions en factures i documents",
    family: "technical_robustness",
    real_case: true,
    source: "Cas d'ús real AImetos",
    authority_fit: 0.84
  }
];

function publishedAt(record: RealContentRecord): string | undefined {
  return record.publishedAtExport || record.publishedAt || record.publishedAtManual;
}

function localParts(now: Date, timezone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "00";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}:${value("second")}`
  };
}

export function normalizeEditorialText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(el|la|los|las|un|una|de|del|y|o|que|en|per|para|amb|con|al|a)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function editorialTextSimilarity(first: string, second: string): number {
  const firstTokens = new Set(normalizeEditorialText(first).split(" ").filter((token) => token.length > 2));
  const secondTokens = new Set(normalizeEditorialText(second).split(" ").filter((token) => token.length > 2));
  if (firstTokens.size === 0 || secondTokens.size === 0) return 0;
  const intersection = [...firstTokens].filter((token) => secondTokens.has(token)).length;
  const union = new Set([...firstTokens, ...secondTokens]).size;
  return intersection / union;
}

export function findPublishedContent(
  candidate: Pick<CandidateTopic, "title" | "topic" | "family"> & { hook?: string },
  records: RealContentRecord[]
): { record: RealContentRecord; similarity: number } | undefined {
  const candidateValues = [candidate.title, candidate.hook || "", candidate.topic].filter(Boolean);
  let best: { record: RealContentRecord; similarity: number } | undefined;
  for (const record of records.filter((item) => item.status !== "metrics_pending" || Boolean(publishedAt(item)))) {
    const recordValues = [record.title, record.hook || "", record.topic].filter(Boolean);
    const exact = candidateValues.some((value) =>
      recordValues.some((published) => normalizeEditorialText(value) === normalizeEditorialText(published))
    );
    const similarity = exact
      ? 1
      : Math.max(...candidateValues.flatMap((value) => recordValues.map((published) => editorialTextSimilarity(value, published))));
    const familyReinforcement = record.editorialFamily === candidate.family ? 0.06 : 0;
    const adjusted = Math.min(1, similarity + familyReinforcement);
    if (!best || adjusted > best.similarity) best = { record, similarity: adjusted };
  }
  return best && best.similarity >= 0.72 ? best : undefined;
}

export function maturityStage(record: RealContentRecord, now = new Date()): MaturityStage {
  const value = publishedAt(record);
  if (!value || !Number.isFinite(Date.parse(value))) return "UNKNOWN";
  const hours = (now.getTime() - Date.parse(value)) / 3_600_000;
  if (hours < 0) return "UNKNOWN";
  if (hours < 24) return "EARLY_SIGNAL";
  if (hours < 72) return "PROVISIONAL";
  if (hours < 168) return "MATURING";
  return "COMPARABLE";
}

function ageHours(record: RealContentRecord, now: Date): number | undefined {
  const value = publishedAt(record);
  if (!value || !Number.isFinite(Date.parse(value))) return undefined;
  return Math.max(0, Math.round(((now.getTime() - Date.parse(value)) / 3_600_000) * 10) / 10);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function numberValue(source: Record<string, unknown> | undefined, key: string): number {
  const value = source?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function latestAggregate(snapshots: PlatformSnapshots | undefined): Record<string, unknown> | undefined {
  const entries = [
    ...(snapshots?.linkedin?.rolling28DaySnapshots || []),
    ...(snapshots?.linkedin?.rolling90DaySnapshots || [])
  ];
  return entries
    .filter((entry) => Number.isFinite(Date.parse(String(entry.capturedAt || ""))))
    .sort((a, b) => Date.parse(String(b.capturedAt)) - Date.parse(String(a.capturedAt)))[0];
}

function observedExperiment(record: RealContentRecord, now: Date): EditorialExperiment | undefined {
  const variables = record.changedVariables || [];
  if (variables.length === 0) return undefined;
  const primary = variables[0] === "hour" ? "time" : variables[0];
  const maturity = maturityStage(record, now);
  return {
    id: `experiment_${record.id}`,
    source: "published_post",
    status: maturity === "COMPARABLE" ? "completed" : "active",
    hypothesis: primary === "time"
      ? "Comprovar si una franja alternativa modifica la distribució mantenint la resta tan estable com sigui possible."
      : `Comprovar l'efecte de la variable ${primary}.`,
    primary_variable: primary,
    control_variables: ["channel=linkedin"],
    confounders: variables.slice(1).map(String),
    expected_signal: "Comparació homogènia a 24 h, 72 h i 7 dies.",
    measurement_windows: ["24h", "72h", "7d"],
    content_id: record.id,
    started_at: publishedAt(record)
  };
}

export function buildEditorialState({
  records,
  platformSnapshots,
  marketSignals = [],
  editorialMemory = [],
  controlState = {},
  candidateTopics = DEFAULT_CANDIDATE_TOPICS,
  now = new Date(),
  timezone = "Europe/Madrid"
}: BuildEditorialStateInput): EditorialState {
  const clock = localParts(now, timezone);
  const warnings: string[] = [];
  const linkedIn = records.filter((record) => record.platform === "linkedin");
  const posts = linkedIn
    .map((record): EditorialPostState => {
      const publication = publishedAt(record);
      const age = ageHours(record, now);
      const latest = newestValidSnapshot(record.snapshots);
      const lastStored = record.snapshots.at(-1);
      if (latest && lastStored && latest !== lastStored) {
        warnings.push(`${record.id}: l'ordre dels snapshots no era cronològic; s'ha aplicat freshness precedence.`);
      }
      return {
        id: record.id,
        title: record.title,
        hook: record.hook || record.title,
        topic: record.topic,
        family: record.editorialFamily,
        published_at: publication,
        maturity: maturityStage(record, now),
        age_hours: age,
        format: record.format,
        visual_style: record.visualStyle,
        cta: record.cta,
        time_slot: record.time_slot,
        snapshots: [...record.snapshots].sort((a, b) =>
          Date.parse(a.capturedAt || "1970-01-01") - Date.parse(b.capturedAt || "1970-01-01")
        ),
        latest_snapshot: latest,
        comparable: record.comparable !== false && Boolean(latest)
      };
    })
    .filter((post) => !post.published_at || Date.parse(post.published_at) <= now.getTime())
    .sort((a, b) => Date.parse(b.published_at || "1970-01-01") - Date.parse(a.published_at || "1970-01-01"));

  const within = (hours: number) => posts.filter((post) => typeof post.age_hours === "number" && post.age_hours <= hours).map((post) => post.id);
  const recentPosts = posts.filter((post) => typeof post.age_hours !== "number" || post.age_hours <= 720);
  const maturePosts = posts.filter((post) => post.maturity === "COMPARABLE" && post.latest_snapshot);
  const timing = analyzePublicationTiming(records);
  const baseline = [...timing.slots].sort((a, b) => b.total_posts - a.total_posts)[0];
  const aggregate = latestAggregate(platformSnapshots);
  const recordSnapshots = posts.map((post) => post.latest_snapshot).filter((snapshot): snapshot is MetricSnapshot => Boolean(snapshot));
  const sum = (field: keyof MetricSnapshot) => recordSnapshots.reduce(
    (total, snapshot) => total + (typeof snapshot[field] === "number" ? Number(snapshot[field]) : 0),
    0
  );
  const audienceView = platformSnapshots?.linkedin?.currentAudienceViews?.at(-1);
  const audienceItem = (key: string): string | undefined => {
    const item = audienceView?.[key];
    return item && typeof item === "object" && "label" in item ? String((item as { label: unknown }).label) : undefined;
  };
  const observed = linkedIn
    .map((record) => observedExperiment(record, now))
    .filter((item): item is EditorialExperiment => Boolean(item))
    .sort((a, b) => Date.parse(b.started_at || "1970-01-01") - Date.parse(a.started_at || "1970-01-01"));
  const currentExperiment = controlState.currentExperiment || observed.find((experiment) => experiment.status === "active");
  const previousExperiments = unique([
    ...(controlState.previousExperiments || []),
    ...observed.filter((experiment) => experiment.id !== currentExperiment?.id)
  ].map((experiment) => JSON.stringify(experiment))).map((experiment) => JSON.parse(experiment) as EditorialExperiment);

  const pending = linkedIn.filter((record) => record.metricsStatus === "pending").map((record) => record.id);
  if (pending.length > 0) warnings.push(`Mètriques pendents o parcials: ${pending.join(", ")}.`);
  const young = posts.filter((post) => post.maturity !== "COMPARABLE" && post.maturity !== "UNKNOWN");
  if (young.length > 0) warnings.push(`${young.map((post) => `${post.id}=${post.maturity}`).join(", ")}; no comparar directament amb resultats a 7 dies.`);
  if (aggregate?.window && String(aggregate.window).includes("rolling")) {
    warnings.push("El snapshot agregat és una finestra mòbil: els percentatges de canvi no demostren causalitat.");
  }
  if (timing.timing_confidence === "insufficient_data" || timing.timing_confidence === "early_signal") {
    warnings.push("La franja 08–10 és la més testada, no una hora guanyadora; el primer test 17–20 encara no permet concloure.");
  }
  if (records.some((record) => record.publishedAtConflict)) warnings.push("Hi ha dates de publicació en conflicte; preval la font exportada més recent.");

  const propagation = {
    shares: numberValue(aggregate, "shares"),
    saves: numberValue(aggregate, "saves"),
    sends: numberValue(aggregate, "sends"),
    out_of_network_percent: numberValue(aggregate, "outOfNetworkPercent"),
    bottleneck: numberValue(aggregate, "shares") === 0 && numberValue(aggregate, "saves") + numberValue(aggregate, "sends") <= 2
  };
  const profileVisits = numberValue(aggregate, "profileViews") || sum("profileViews");
  const leads = sum("qualifiedLeads");
  const meetings = sum("meetings");
  const comments = numberValue(aggregate, "comments") || sum("comments");

  return {
    current_date: clock.date,
    current_time: clock.time,
    timezone,
    recent_posts: recentPosts,
    mature_posts: maturePosts,
    last_24h: within(24),
    last_72h: within(72),
    last_7d: within(168),
    last_30d: within(720),
    last_90d: within(2160),
    published_topics: unique(posts.map((post) => post.topic)),
    published_hooks: unique(posts.map((post) => post.hook)),
    editorial_families: unique(posts.map((post) => post.family)),
    recent_formats: unique(recentPosts.slice(0, 6).map((post) => post.format)),
    recent_visual_styles: unique(recentPosts.slice(0, 6).map((post) => post.visual_style).filter((value): value is string => Boolean(value))),
    recent_ctas: unique(recentPosts.slice(0, 6).map((post) => post.cta).filter((value): value is string => Boolean(value))),
    time_slots: timing.slots,
    time_slot_samples: Object.fromEntries(timing.slots.map((slot) => [slot.time_slot, slot.comparable_24h_posts])) as Record<PublicationTimeSlot, number>,
    timing_confidence: timing.timing_confidence,
    timing_reason: timing.timing_reason,
    timing_baseline: baseline?.total_posts ? baseline.time_slot : null,
    content_patterns: [
      {
        id: "maturation",
        label: "Les primeres 24 hores no són suficients per jutjar una publicació.",
        confidence: "strong_pattern",
        evidence: ["LI-16: 110 → 267 impressions", "LI-09: 64 → 221 impressions"]
      },
      {
        id: "propagation_bottleneck",
        label: "La propagació externa continua sent el principal coll d'ampolla.",
        confidence: "developing_pattern",
        evidence: [`${propagation.shares} comparticions`, `${propagation.saves} guardat(s)`, `${propagation.sends} enviament(s)`]
      },
      {
        id: "authority_fit",
        label: "Els casos pròxims a l'experiència professional poden millorar la qualitat de resposta.",
        confidence: "developing_pattern",
        evidence: [`LI-16: ${comments > 0 ? "comentaris i" : ""} visites al perfil`, "Només un datapoint fort; no prova causalitat"]
      }
    ],
    pattern_confidence: maturePosts.length >= 8 ? "developing_pattern" : "early_signal",
    content_confidence: maturePosts.length >= 8 ? "developing_pattern" : "early_signal",
    format_confidence: "insufficient_data",
    visual_confidence: "insufficient_data",
    current_experiment: currentExperiment,
    previous_experiments: previousExperiments,
    audience_summary: {
      inexperienced_percent: numberValue(audienceView, "inexperiencedPercent") || undefined,
      location: audienceItem("location"),
      company_size: audienceItem("companySize"),
      sector: audienceItem("sector"),
      company: audienceItem("company"),
      role: audienceItem("role"),
      note: "Audiència mixta; encara no es pot afirmar que predomini el perfil decisor."
    },
    propagation_metrics: propagation,
    commercial_signals: {
      profile_visits: profileVisits,
      connection_requests: sum("connectionRequestsReceived"),
      messages: sum("messagesReceived"),
      leads,
      meetings,
      confirmed_commercial_result: leads > 0 || meetings > 0
    },
    profile_visits: profileVisits,
    followers: numberValue(aggregate, "followersTotal") || Math.max(0, ...recordSnapshots.map((snapshot) => snapshot.followers || 0)),
    leads,
    meetings,
    candidate_topics: candidateTopics,
    real_use_cases_available: REAL_USE_CASES,
    data_quality_warnings: unique(warnings),
    market_signals: marketSignals,
    editorial_memory: editorialMemory
  };
}
