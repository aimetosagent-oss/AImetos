import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BusinessContentScore,
  ContentIdea,
  EditorialMemoryItem,
  MarketSignal,
  MetricRecord,
  RealContentRecord
} from "../../shared/src/domain.ts";
import { loadConfig, type RuntimeConfig } from "../../config/src/env.ts";
import { analyzePerformance } from "../../analytics/src/performance.ts";
import { confidenceFromSample, latestSnapshot, rankRealContent } from "../../analytics/src/business-content.ts";
import { generateFiveIdeas, selectBestIdeas } from "../../strategy/src/ideation.ts";
import { generateContentForIdea } from "../../content/src/generator.ts";
import { publishMock, scheduleContent } from "../../publishing/src/scheduler.ts";
import { buildConnectorRegistry } from "../../connectors/src/registry.ts";
import { transitionPath } from "./state-machine.ts";
import { validateIdea, validateMetric } from "../../validation/src/schemas.ts";

export type MockFlowReport = {
  runId: string;
  mode: string;
  scenario: string;
  analysis: ReturnType<typeof analyzePerformance>;
  generatedIdeas: ContentIdea[];
  selectedIdeas: ContentIdea[];
  approvedIdeas: ContentIdea[];
  contents: ReturnType<typeof generateContentForIdea>[];
  publications: ReturnType<typeof publishMock>[];
  auditLog: ReturnType<typeof transitionPath>;
  connectorHealth: Array<{ name: string; status: string; ok: boolean; message: string }>;
  metricsCollected: boolean;
  report: {
    summary: string;
    recommendations: string[];
  };
};

export type ClientContentRecommendation = {
  title: string;
  format: string;
  channel: string;
  displayFormat: string;
  displayChannel: string;
  reason: string;
  recommended: boolean;
  whyRecommended: string;
  hook: string;
  postCopy: string;
  bestPublishTime: string;
  metricsToTrack: string[];
  publicationStatus: "pending_publish" | "published" | "metrics_24h" | "metrics_72h" | "validated";
  productionBrief: string;
  visualBrief: string;
  imageAsset: string;
  imagePrompt: string;
  cta: string;
  effort: "low" | "medium" | "high";
  targetCustomer: string;
  concreteProblem: string;
  funnelStage: "TOFU" | "MOFU" | "BOFU";
  singleObjective: string;
  businessConsequence: string;
  proofOrExample: string;
};

export type ClientMonthlyReport = {
  reportId: string;
  clientName: string;
  period: string;
  generatedAt: string;
  executiveSummary: string;
  businessObjective: string;
  strategy: {
    quarterly: string;
    monthly: string;
    publication: string;
  };
  decision: {
    nextBestFormat: string;
    nextBestChannel: string;
    nextAction: string;
    confidence: ReturnType<typeof confidenceFromSample>;
    confidenceLabel: string;
    confidenceNote: string;
  };
  realIntelligence: {
    confidence: {
      level: ReturnType<typeof confidenceFromSample>;
      label: string;
      comparablePosts: number;
      warning: string;
    };
    horizons: Array<{ label: string; weight: number }>;
    global: {
      linkedinPosts: number;
      instagramPosts: number;
      measuredPosts: number;
      impressions: number;
      reach: number;
      profileViews: number;
      reactions: number;
      comments: number;
      followers: number;
      probableInvitations: number;
      confirmedLeads: number;
      meetings: number;
    };
    winners: Array<{ key: string; label: string; contentId: string; title: string; reason: string }>;
    scoredContent: Array<{
      id: string;
      platform: string;
      title: string;
      topic: string;
      status: string;
      sourceType: string;
      latest: ReturnType<typeof latestSnapshot>;
      snapshots: RealContentRecord["snapshots"];
      score: BusinessContentScore;
    }>;
    audience: {
      decisionMakerPeak: number;
      audienceFitScore: number;
      sectors: string[];
      companySizes: string[];
      locations: string[];
      reading: string;
    };
    commercialSignals: {
      profileViews: number;
      connectionRequestsReceived: number;
      probableAttributedConnections: number;
      messages: number;
      leads: number;
      meetings: number;
      proposals: number;
      opportunities: number;
      attributionNote: string;
    };
    weeklyComparisons: Array<{
      period: string;
      impressions: number;
      reach: number;
      profileViews: number;
      reactions: number;
      comments: number;
      reading: string;
    }>;
    instagram: {
      posts: number;
      views: number;
      reactions: number;
      bestReach: string;
      bestRelativeEngagement: string;
      warning: string;
    };
    marketSignals: MarketSignal[];
    editorialMemory: EditorialMemoryItem[];
    dataStates: Array<{ sourceType: string; count: number }>;
  };
  weeklyValidation: {
    period: string;
    status: "initial_positive" | "needs_adjustment" | "validated";
    summary: string;
    totals: {
      posts: number;
      impressions: number;
      reach: number;
      profileVisits: number;
      reactions: number;
      comments: number;
      shares: number;
      saves: number;
      newFollowers: number;
      probableInvitations: number;
      qualifiedLeads: number;
      meetings: number;
    };
    visibilityWinner: { title: string; reason: string };
    audienceQualityWinner: { title: string; reason: string };
    commercialSignal: string;
    nextDecision: string;
  };
  topContent: Array<{
    rank: number;
    title: string;
    platform: string;
    format: string;
    topic: string;
    whyItWorked: string;
    metrics: {
      reach: number;
      views: number;
      impressions?: number;
      reactions?: number;
      comments?: number;
      profileVisits?: number;
      saves: number;
      shares: number;
      qualifiedLeads: number;
      meetings: number;
      score: number;
    };
  }>;
  formatInsights: Array<{
    format: string;
    score: number;
    recommendation: string;
  }>;
  recommendations: ClientContentRecommendation[];
  socialDistribution: Array<{
    channel: "linkedin" | "instagram" | "facebook_business" | "facebook_personal" | "blog" | "newsletter" | "youtube";
    label: string;
    recommendedScore: number;
    recommended: boolean;
    recommendation: "publish_now" | "adapt_and_publish" | "reuse_and_publish" | "not_recommended";
    format: string;
    publishTime: string;
    status: "pending_publish" | "scheduled" | "published" | "validated" | "not_planned";
    adaptationStatus: "ready" | "draft_needed" | "not_required";
    scheduledAt?: string;
    publishedAt?: string;
    metricsStatus: "pending" | "partial" | "collected" | "not_applicable";
    reason: string;
    sourceContentId: string;
    adaptation: string;
    coherenceRule: string;
    metricsToTrack: string[];
  }>;
  calendar: Array<{
    day: string;
    title: string;
    format: string;
    channel: string;
    owner: string;
    status: "ready_to_review" | "draft_needed" | "scheduled";
  }>;
  technicalStatus: {
    mode: string;
    dataSource: string;
    credentialsRequiredNow: boolean;
    n8nWorkflowsValidated: number;
  };
};

function rootPath(relPath: string): string {
  return fileURLToPath(new URL("../../../" + relPath, import.meta.url));
}

function readJson<T>(relPath: string): T {
  return JSON.parse(readFileSync(rootPath(relPath), "utf8")) as T;
}

function applyScenario(records: MetricRecord[], scenario: string): MetricRecord[] {
  if (scenario === "missing_data") {
    return records.map((record, index) => (index % 4 === 0 ? { ...record, clicks: 0, ctr: 0 } : record));
  }
  if (scenario === "partial_metrics") {
    return records.filter((_, index) => index % 3 !== 0);
  }
  if (scenario === "high_performance") {
    return records.map((record) => ({
      ...record,
      leads: record.leads + 2,
      qualifiedLeads: record.qualifiedLeads + 1,
      meetings: record.meetings + (record.platform === "linkedin" ? 1 : 0),
      attributedRevenue: record.attributedRevenue + 2500
    }));
  }
  if (scenario === "low_performance" || scenario === "no_qualified_ideas") {
    return records.map((record) => ({
      ...record,
      leads: Math.floor(record.leads / 2),
      qualifiedLeads: 0,
      meetings: 0,
      attributedRevenue: 0,
      ctr: Number((record.ctr / 2).toFixed(4))
    }));
  }
  return records;
}

function contentScore(record: MetricRecord): number {
  return Number(
    (
      record.qualifiedLeads * 28 +
      record.meetings * 35 +
      record.saves * 4 +
      record.shares * 5 +
      record.comments * 2 +
      record.retention * 30 +
      record.ctr * 250
    ).toFixed(2)
  );
}

function clientTitle(record: MetricRecord): string {
  const topic = record.topic.replace(/-/g, " ");
  const format = record.format.replace(/-/g, " ");
  if (record.platform === "instagram") return "Peça visual sobre " + topic + " (" + format + ")";
  if (record.platform === "youtube") return "Vídeo explicatiu sobre " + topic;
  if (record.platform === "linkedin") return "Post de decisió sobre " + topic;
  return "Contingut sobre " + topic;
}

function whyItWorked(record: MetricRecord): string {
  const signals = [];
  if (record.qualifiedLeads > 0) signals.push("ha generat leads qualificats");
  if (record.meetings > 0) signals.push("ha acabat en reunions");
  if (record.saves >= 5) signals.push("s'ha guardat com a referència");
  if (record.shares >= 4) signals.push("s'ha compartit dins equips");
  if (record.retention >= 0.55) signals.push("ha mantingut bona retenció");
  return signals.length > 0
    ? "Funciona perquè " + signals.join(", ") + "."
    : "Funciona com a peça de suport, però encara necessita un CTA més clar.";
}

function formatScores(records: MetricRecord[]): Array<{ format: string; score: number; recommendation: string }> {
  const scores = new Map<string, number>();
  for (const record of records) {
    scores.set(record.format, Number(((scores.get(record.format) || 0) + contentScore(record)).toFixed(2)));
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([format, score], index) => ({
      format,
      score,
      recommendation:
        index === 0
          ? "Format prioritari del mes vinent. Repetir angle i adaptar-lo a 2 canals."
          : "Mantenir com a suport si encaixa amb el tema guanyador."
    }));
}

type LinkedInPostInput = {
  id: string;
  url: string;
  topic: string;
  format: string;
  knownFromUrl: string[];
  manualMetrics: {
    impressions: number | null;
    reach?: number | null;
    reactions: number | null;
    comments: number | null;
    shares: number | null;
    saves?: number | null;
    profileVisits: number | null;
    newFollowers?: number | null;
    leads: number | null;
    meetings: number | null;
  };
};

type LinkedInWeeklyReportInput = {
  period: string;
  status: "initial_positive" | "needs_adjustment" | "validated";
  summary: string;
  totals: ClientMonthlyReport["weeklyValidation"]["totals"];
  posts: Array<{ id: string; title: string; reading: string }>;
  visibilityWinnerId: string;
  audienceQualityWinnerId: string;
  commercialSignal: string;
  nextDecision: string;
};

type ManualMetricEntry = {
  id: string;
  platform: "linkedin" | "instagram" | "facebook";
  contentId: string;
  capturedAt: string;
  period: "24h" | "48h" | "72h" | "7d" | "30d" | "latest";
  impressions: number;
  views: number;
  reach: number;
  reactions: number;
  comments: number;
  shares: number;
  saves: number;
  sends: number;
  profileViews: number;
  followers: number;
  invites: number;
  leads: number;
  meetings: number;
  audienceBreakdown: string;
  notes: string;
  sourceType: "real_manual" | "real_export" | "estimated" | "pending";
};

function hasLinkedInMetrics(posts: LinkedInPostInput[]): boolean {
  return posts.every((post) => typeof post.manualMetrics.impressions === "number");
}

function linkedInScore(post: LinkedInPostInput): number {
  const metrics = post.manualMetrics;
  return Number(
    (
      (metrics.impressions || 0) * 0.03 +
      (metrics.reactions || 0) * 2 +
      (metrics.comments || 0) * 8 +
      (metrics.shares || 0) * 12 +
      (metrics.profileVisits || 0) * 3 +
      (metrics.newFollowers || 0) * 15 +
      (metrics.leads || 0) * 30 +
      (metrics.meetings || 0) * 45
    ).toFixed(2)
  );
}

function linkedInTitle(post: LinkedInPostInput): string {
  if (post.topic.includes("transformaciondigital")) return "Transformacio digital, IA i PIMEs";
  if (post.topic.includes("engineering")) return "Workflows de disseny parametric i hardware";
  if (post.topic.includes("projectmanagement")) return "Planificacio basica de projectes";
  return post.topic.replace(/-/g, " ");
}

function linkedInWhyItWorked(post: LinkedInPostInput): string {
  const metrics = post.manualMetrics;
  const parts = [];
  if ((metrics.impressions || 0) >= 1500) parts.push("ha tingut bon abast");
  if ((metrics.comments || 0) >= 5) parts.push("ha generat conversa");
  if ((metrics.shares || 0) > 0) parts.push("s'ha compartit");
  if ((metrics.profileVisits || 0) >= 20) parts.push("ha portat visites al perfil");
  if ((metrics.newFollowers || 0) > 0) parts.push("ha generat nous seguidors");
  return parts.length > 0
    ? "Funciona perquè " + parts.join(", ") + "."
    : "Encara és una peça de senyal baix; serveix com a mostra, però no com a patró fort.";
}

function confidenceLabelCa(level: ReturnType<typeof confidenceFromSample>): string {
  const labels = {
    insufficient_data: "Dades insuficients",
    early_signal: "Senyal inicial",
    developing_pattern: "Patró en desenvolupament",
    moderate_confidence: "Confiança moderada",
    high_confidence: "Confiança alta"
  };
  return labels[level];
}

function buildRealIntelligence(
  records: RealContentRecord[],
  marketSignals: MarketSignal[],
  editorialMemory: EditorialMemoryItem[]
): ClientMonthlyReport["realIntelligence"] {
  const linkedin = records.filter((record) => record.platform === "linkedin");
  const instagram = records.filter((record) => record.platform === "instagram");
  const measured = records.filter((record) => latestSnapshot(record));
  const linkedinMeasured = linkedin.filter((record) => latestSnapshot(record));
  const ranked = rankRealContent(records, marketSignals);
  const scoredContent = ranked.map(({ record, score }) => ({
    id: record.id,
    platform: record.platform,
    title: record.title,
    topic: record.topic,
    status: record.status,
    sourceType: record.sourceType,
    latest: latestSnapshot(record),
    snapshots: record.snapshots,
    score
  }));
  const snapshots = measured.map(latestSnapshot).filter((item): item is NonNullable<ReturnType<typeof latestSnapshot>> => Boolean(item));
  const sumField = (field: keyof NonNullable<ReturnType<typeof latestSnapshot>>) =>
    snapshots.reduce((total, snapshot) => total + (typeof snapshot[field] === "number" ? Number(snapshot[field]) : 0), 0);
  const confidence = confidenceFromSample(linkedinMeasured.length);
  const audienceRecords = linkedin.filter((record) => record.audience);
  const sectors = [...new Set(audienceRecords.flatMap((record) => record.audience?.prioritySectors || []))];
  const companySizes = [...new Set(audienceRecords.flatMap((record) => record.audience?.companySizes?.map((item) => item.label) || []))];
  const locations = [...new Set(audienceRecords.flatMap((record) => record.audience?.locations?.map((item) => item.label) || []))];
  const decisionMakerPeak = Math.max(0, ...audienceRecords.map((record) => record.audience?.decisionMakersPercent || 0));
  const instagramSnapshots = instagram.map(latestSnapshot).filter((item): item is NonNullable<ReturnType<typeof latestSnapshot>> => Boolean(item));
  const igViews = instagramSnapshots.reduce((total, snapshot) => total + (snapshot.views || 0), 0);
  const igReactions = instagramSnapshots.reduce((total, snapshot) => total + (snapshot.reactions || 0), 0);
  const sourceCounts = new Map<string, number>();
  for (const record of records) sourceCounts.set(record.sourceType, (sourceCounts.get(record.sourceType) || 0) + 1);

  return {
    confidence: {
      level: confidence,
      label: confidenceLabelCa(confidence),
      comparablePosts: linkedinMeasured.length,
      warning: "Mostra petita: les conclusions són hipòtesis editorials, no patrons ferms. Cap resultat probable es compta com a lead confirmat."
    },
    horizons: [
      { label: "Últims 30 dies", weight: 60 },
      { label: "Últims 90 dies", weight: 30 },
      { label: "Històric", weight: 10 }
    ],
    global: {
      linkedinPosts: linkedin.length,
      instagramPosts: instagram.length,
      measuredPosts: measured.length,
      impressions: linkedinMeasured.reduce((total, record) => total + (latestSnapshot(record)?.impressions || 0), 0),
      reach: linkedinMeasured.reduce((total, record) => total + (latestSnapshot(record)?.reach || 0), 0),
      profileViews: sumField("profileViews"),
      reactions: sumField("reactions"),
      comments: sumField("comments"),
      followers: sumField("followers"),
      probableInvitations: snapshots.reduce(
        (total, snapshot) => total + (snapshot.attributionConfidence === "probable" ? snapshot.connectionRequestsAttributed || 0 : 0),
        0
      ),
      confirmedLeads: sumField("qualifiedLeads"),
      meetings: sumField("meetings")
    },
    winners: [
      { key: "reach", label: "Millor abast LinkedIn", contentId: "LI-01", title: linkedin.find((record) => record.id === "LI-01")?.title || "-", reason: "281 impressions, 138 membres assolits i 9 visites al perfil." },
      { key: "conversation", label: "Millor conversa LinkedIn", contentId: "LI-03", title: linkedin.find((record) => record.id === "LI-03")?.title || "-", reason: "2 comentaris qualitatius que reforcen criteri abans que tecnologia; LI-04 confirma el mateix angle." },
      { key: "audience", label: "Millor qualitat potencial", contentId: "LI-02", title: linkedin.find((record) => record.id === "LI-02")?.title || "-", reason: "29% de decisors estimats i primer seguidor atribuït; el model híbrid LI-04 aporta 20% de gerents." },
      { key: "commercial", label: "Millor senyal comercial", contentId: "LI-02", title: linkedin.find((record) => record.id === "LI-02")?.title || "-", reason: "1 seguidor atribuït i 1 invitació probable, sense convertir-la en lead." },
      { key: "worst", label: "Pitjor resultat inicial", contentId: "LI-05", title: linkedin.find((record) => record.id === "LI-05")?.title || "-", reason: "38 impressions i cap interacció a ~48 h. Resultat primerenc, no conclusió definitiva." },
      { key: "instagram", label: "Millor interès relatiu Instagram", contentId: "IG-03", title: instagram.find((record) => record.id === "IG-03")?.title || "-", reason: "3 m'agrada sobre 7 visualitzacions; mostra insuficient per validar el patró." }
    ],
    scoredContent,
    audience: {
      decisionMakerPeak,
      audienceFitScore: Math.round((decisionMakerPeak * 0.6 + Math.min(100, sectors.length * 25) * 0.4) * 10) / 10,
      sectors,
      companySizes,
      locations,
      reading: "La millor composició potencial apareix en dashboards i model híbrid: menys volum, però més gerents, directors, indústria i empreses mitjanes."
    },
    commercialSignals: {
      profileViews: sumField("profileViews"),
      connectionRequestsReceived: sumField("connectionRequestsReceived"),
      probableAttributedConnections: snapshots.reduce(
        (total, snapshot) => total + (snapshot.attributionConfidence === "probable" ? snapshot.connectionRequestsAttributed || 0 : 0),
        0
      ),
      messages: sumField("messagesReceived"),
      leads: sumField("qualifiedLeads"),
      meetings: sumField("meetings"),
      proposals: sumField("proposals"),
      opportunities: sumField("opportunities"),
      attributionNote: "Les invitacions es registren com a probables i no confirmades. No compten com a leads."
    },
    weeklyComparisons: [
      { period: "14-19 juliol", impressions: 416, reach: 212, profileViews: 12, reactions: 7, comments: 0, reading: "Més visibilitat i visites; sense conversa. LI-02 va créixer després fins a 193 impressions i 1 seguidor." },
      { period: "21-23 juliol", impressions: 215, reach: 92, profileViews: 6, reactions: 4, comments: 4, reading: "Menys volum, però més conversa i millor senyal qualitatiu de criteri abans que tecnologia." }
    ],
    instagram: {
      posts: instagram.length,
      views: igViews,
      reactions: igReactions,
      bestReach: "IG-01 · 12 visualitzacions",
      bestRelativeEngagement: "IG-03 · 3 m'agrada / 7 visualitzacions",
      warning: "Mostra molt petita: cap comentari, compartició o enviament. No hi ha patró ferm."
    },
    marketSignals,
    editorialMemory,
    dataStates: [...sourceCounts.entries()].map(([sourceType, count]) => ({ sourceType, count }))
  };
}

export async function buildClientMonthlyReport(overrides: Partial<RuntimeConfig> = {}): Promise<ClientMonthlyReport> {
  const flow = await runMockContentFlow(overrides);
  const rawMetrics = readJson<MetricRecord[]>("data/fixtures/content-performance.json");
  const linkedInPosts = readJson<LinkedInPostInput[]>("data/fixtures/linkedin-posts.json");
  const realContent = readJson<RealContentRecord[]>("data/fixtures/real-content.json");
  const manualEntries = readJson<ManualMetricEntry[]>("data/fixtures/manual-metric-entries.json");
  const mergedRealContent = realContent.map((record) => ({
    ...record,
    snapshots: [
      ...record.snapshots,
      ...manualEntries
        .filter((entry) => entry.contentId === record.id)
        .map((entry) => ({
          capturedAt: entry.capturedAt,
          period: entry.period,
          impressions: entry.impressions,
          views: entry.views,
          reach: entry.reach,
          reactions: entry.reactions,
          comments: entry.comments,
          shares: entry.shares,
          saves: entry.saves,
          sends: entry.sends,
          profileViews: entry.profileViews,
          followers: entry.followers,
          connectionRequestsReceived: entry.invites,
          connectionRequestsAttributed: 0,
          attributionConfidence: "unknown" as const,
          qualifiedLeads: entry.leads,
          meetings: entry.meetings,
          sourceType: entry.sourceType,
          notes: entry.notes
        }))
    ]
  }));
  const marketSignals = readJson<MarketSignal[]>("data/fixtures/market-signals.json");
  const editorialMemory = readJson<EditorialMemoryItem[]>("data/fixtures/editorial-memory.json");
  const realIntelligence = buildRealIntelligence(mergedRealContent, marketSignals, editorialMemory);
  const config = { ...loadConfig(), ...overrides };
  const metrics = applyScenario(rawMetrics, config.mockScenario);
  const topContent = realIntelligence.scoredContent
    .filter((item) => item.platform === "linkedin")
    .map((item, index) => ({
      rank: index + 1,
      title: item.title,
      platform: item.platform,
      format: "Post LinkedIn",
      topic: item.topic,
      whyItWorked: item.score.explanation,
      metrics: {
        reach: item.latest?.reach || 0,
        views: item.latest?.impressions || item.latest?.views || 0,
        impressions: item.latest?.impressions || 0,
        reactions: item.latest?.reactions || 0,
        comments: item.latest?.comments || 0,
        profileVisits: item.latest?.profileViews || 0,
        saves: item.latest?.saves || 0,
        shares: item.latest?.shares || 0,
        qualifiedLeads: item.latest?.qualifiedLeads || 0,
        meetings: item.latest?.meetings || 0,
        score: item.score.total
      }
    }));

  const insights = ["linkedin", "instagram"].map((platform) => {
    const items = realIntelligence.scoredContent.filter((item) => item.platform === platform);
    const score = items.length === 0 ? 0 : Number((items.reduce((total, item) => total + item.score.total, 0) / items.length).toFixed(1));
    return {
      format: platform === "linkedin" ? "Post LinkedIn" : "Peça visual Instagram",
      score,
      recommendation:
        platform === "linkedin"
          ? "Canal principal. Prioritzar qualitat d'audiència, conversa i visites al perfil."
          : "Canal de reforç visual. No declarar patró fins tenir més abast i interaccions."
    };
  });
  const imageAssets = [
    "",
    "",
    ""
  ];
  const visualBriefs = [
    "Imatge de decisió amb una resposta automàtica al centre i tres filtres humans: context, risc i responsable. Inclou el logo AImetos en petit.",
    "Imatge tipus full de ruta: cinc passos ordenats 'Dades', 'Camps', 'Alertes', 'Workflows' i 'IA'. Inclou el logo AImetos en petit.",
    "Imatge de decisió amb dues columnes: 'Quan sí' i 'Quan no' per a un agent de WhatsApp. Inclou el logo AImetos en petit."
  ];
  const imagePrompts = [
    "Crea una imatge professional per LinkedIn, format 1200x627, estil de consultoria tecnològica B2B. Titular: 'La IA ho va dir. Ningú no ho va qüestionar.' Subtítol: 'Automatitzar una resposta no elimina la responsabilitat'. Mostra tres filtres visuals: Context, Risc i Responsable. Paleta blanca, verd petroli, blau i gris. Inclou el logo AImetos original en petit. Sense persones, sense estil stock i sense text petit.",
    "Crea una imatge professional per LinkedIn, format 1200x627, estil de consultoria tecnològica B2B, net i sobri. Titular: 'Abans d'afegir IA al CRM, ordena això'. Mostra una seqüència clara de cinc passos: Dades, Camps, Alertes, Workflows i IA. Paleta blanca, verd petroli, blau i gris. Inclou el logo AImetos original en petit a una cantonada. Sense persones, sense estil stock i sense text petit.",
    "Crea una imatge professional per LinkedIn, format 1200x627, estil de consultoria tecnològica B2B. Titular: 'Agent de WhatsApp: quan suma i quan afegeix soroll'. Composició comparativa amb dues columnes, 'Quan sí' i 'Quan no', i tres criteris breus per columna. Paleta blanca, verd petroli, blau i gris. Inclou el logo AImetos original en petit a una cantonada. Sense persones ni estil stock."
  ];
  const bestPublishTimes = [
    "Dimarts a les 08:40",
    "Dimecres a les 09:10",
    "Dijous a les 08:50"
  ];
  const postCopies = [
    "La IA ho va dir. Ningú no ho va qüestionar.\n\nAquest és un dels riscos més silenciosos quan incorporem IA a un procés intern.\n\nAbans d'acceptar una resposta automàtica, jo faria tres preguntes:\n\n1. Té prou context per decidir?\n2. Quin és el cost si s'equivoca?\n3. Qui valida el resultat i n'assumeix la responsabilitat?\n\nLa IA pot accelerar una decisió. No hauria d'eliminar el criteri humà.\n\nSi et serveix, puc compartir una checklist breu per definir quines decisions pot assistir la IA i quines han de continuar validades per una persona.",
    "Afegir IA a un CRM desordenat no resol el problema. L'accelera.\n\nAbans d'incorporar un agent, jo revisaria cinc capes:\n\n1. Dades mínimes completes.\n2. Camps que reflecteixen el procés real.\n3. Alertes per als seguiments crítics.\n4. Workflows repetibles.\n5. IA per decidir o assistir on aporta valor.\n\nLa IA comercial funciona millor quan el sistema ja sap què ha de passar després.\n\nSi vols, puc compartir aquesta seqüència en format checklist.",
    "Un agent de WhatsApp no arregla un procés comercial desordenat.\n\nTé sentit quan les consultes són repetitives, hi ha una resposta clara i cada conversa acaba registrada.\n\nAfegeix soroll quan ningú sap qui continua el lead, les dades queden disperses o cada cas necessita una decisió diferent.\n\nPrimer procés, després canal i finalment agent.\n\nSi vols, puc compartir un esquema simple per decidir si cal agent, CRM o redissenyar el procés."
  ];
  const displayFormats = [
    "Post LinkedIn",
    "Carrusel LinkedIn",
    "Document LinkedIn"
  ];
  const metricsToTrack = [
    "Impressions",
    "Reaccions",
    "Comentaris",
    "Comparticions",
    "Visites al perfil",
    "Nous seguidors",
    "Leads",
    "Reunions"
  ];
  const nextIdeaIds = ["idea_ai_criterion", "idea_crm_ai", "idea_whatsapp_agent"];
  const nextIdeas = nextIdeaIds
    .map((id) => flow.generatedIdeas.find((idea) => idea.id === id))
    .filter((idea): idea is ContentIdea => Boolean(idea));
  const nextContents = nextIdeas.map(generateContentForIdea);
  const recommendations = nextIdeas.map((idea, index): ClientContentRecommendation => {
    const content = nextContents[index];
    const reel = content?.adaptations.find((item) => item.channel === "reels");
    const visual = content?.adaptations.find((item) => item.channel === "visual");
    return {
      title: idea.title,
      format: index === 0 ? "linkedin-post" : index === 1 ? "linkedin-carousel" : "linkedin-document",
      channel: "linkedin",
      displayFormat: displayFormats[index] || "Post LinkedIn",
      displayChannel: "LinkedIn",
      reason: idea.justification,
      recommended: index === 0,
      whyRecommended:
        index === 0
          ? "És la millor opció perquè aprofita el senyal qualitatiu de criteri abans que tecnologia, evita repetir agents de veu i obre una línia de governança de la IA."
          : "Opció de suport per continuar provant angles de decisió empresarial amb autoritat tècnica.",
      hook: idea.pain,
      postCopy: postCopies[index] || postCopies[0],
      bestPublishTime: bestPublishTimes[index] || bestPublishTimes[0],
      metricsToTrack,
      publicationStatus: "pending_publish",
      productionBrief: reel?.content || visual?.content || idea.mainMessage,
      visualBrief: visualBriefs[index] || "Visual net, professional i relacionat amb el problema principal del post. Inclou el logo AImetos en petit.",
      imageAsset: imageAssets[index] || "",
      imagePrompt: imagePrompts[index] || imagePrompts[0],
      cta: idea.cta,
      effort: idea.estimatedEffort <= 2 ? "low" : idea.estimatedEffort === 3 ? "medium" : "high",
      targetCustomer: idea.audience,
      concreteProblem: idea.pain,
      funnelStage: idea.funnelStage,
      singleObjective: idea.objective,
      businessConsequence: idea.businessConsequence,
      proofOrExample: idea.proofOrExample
    };
  });
  const socialDistribution: ClientMonthlyReport["socialDistribution"] = [
    {
      channel: "linkedin",
      label: "LinkedIn",
      recommendedScore: 95,
      recommended: true,
      recommendation: "publish_now",
      format: "Post amb imatge",
      publishTime: "Dimarts a les 08:40",
      status: "pending_publish",
      adaptationStatus: "ready",
      metricsStatus: "pending",
      reason: "Canal principal B2B i única xarxa amb senyals de conversa i qualitat d'audiència.",
      sourceContentId: "idea_ai_criterion",
      adaptation: "Publicació de criteri: tres filtres humans abans d'acceptar una resposta automàtica.",
      coherenceRule: "Un client, un problema, una fase MOFU, un objectiu i un CTA.",
      metricsToTrack
    },
    {
      channel: "instagram",
      label: "Instagram",
      recommendedScore: 70,
      recommended: true,
      recommendation: "adapt_and_publish",
      format: "Carrusel de 4 slides",
      publishTime: "Dimecres a les 12:30",
      status: "pending_publish",
      adaptationStatus: "draft_needed",
      metricsStatus: "pending",
      reason: "Aparador de marca i reforç visual; la mostra actual encara és insuficient per prioritzar-lo per rendiment.",
      sourceContentId: "idea_ai_criterion",
      adaptation: "Portada i tres slides: context, risc i responsable. CTA de guardar la checklist.",
      coherenceRule: "Mateix problema i mateixa conclusió, amb menys text i lectura ràpida.",
      metricsToTrack: ["Abast", "M'agrada", "Comentaris", "Desats", "Comparticions", "Visites al perfil", "Leads"]
    },
    {
      channel: "facebook_business",
      label: "Facebook empresa",
      recommendedScore: 55,
      recommended: true,
      recommendation: "reuse_and_publish",
      format: "Post curt amb imatge",
      publishTime: "Dijous a les 18:15",
      status: "pending_publish",
      adaptationStatus: "ready",
      metricsStatus: "pending",
      reason: "Repositori actiu i suport de credibilitat; publicació sincronitzada amb Instagram.",
      sourceContentId: "idea_ai_criterion",
      adaptation: "Reutilitzar la peça Meta amb text més directe i divulgatiu.",
      coherenceRule: "Mateixa imatge i mateixa promesa, amb un to més divulgatiu i menys consultiu.",
      metricsToTrack: ["Abast", "Reaccions", "Comentaris", "Comparticions", "Clics", "Missatges", "Leads"]
    },
    {
      channel: "facebook_personal",
      label: "Facebook personal",
      recommendedScore: 20,
      recommended: false,
      recommendation: "not_recommended",
      format: "No planificat",
      publishTime: "-",
      status: "not_planned",
      adaptationStatus: "not_required",
      metricsStatus: "not_applicable",
      reason: "Ús ocasional; no és canal principal de màrqueting.",
      sourceContentId: "idea_ai_criterion",
      adaptation: "Cap adaptació prevista.",
      coherenceRule: "Publicar només quan hi hagi context personal rellevant.",
      metricsToTrack: []
    },
    {
      channel: "blog",
      label: "Blog",
      recommendedScore: 65,
      recommended: true,
      recommendation: "adapt_and_publish",
      format: "Article de criteri",
      publishTime: "Setmana següent",
      status: "pending_publish",
      adaptationStatus: "draft_needed",
      metricsStatus: "pending",
      reason: "Permet aprofundir en governança i responsabilitat sense carregar el post social.",
      sourceContentId: "idea_ai_criterion",
      adaptation: "Article amb matriu de risc i exemples de decisions assistides.",
      coherenceRule: "Ampliar la prova, no canviar la conclusió editorial.",
      metricsToTrack: ["Lectures", "Temps de lectura", "Clics", "Leads"]
    },
    {
      channel: "newsletter",
      label: "Newsletter",
      recommendedScore: 45,
      recommended: false,
      recommendation: "not_recommended",
      format: "Resum breu",
      publishTime: "-",
      status: "not_planned",
      adaptationStatus: "not_required",
      metricsStatus: "not_applicable",
      reason: "Encara no hi ha una cadència ni base suficient per prioritzar aquest canal.",
      sourceContentId: "idea_ai_criterion",
      adaptation: "Reservar com a bloc d'una futura edició.",
      coherenceRule: "No obrir un canal nou sense procés de seguiment.",
      metricsToTrack: []
    },
    {
      channel: "youtube",
      label: "YouTube",
      recommendedScore: 25,
      recommended: false,
      recommendation: "not_recommended",
      format: "Vídeo explicatiu",
      publishTime: "-",
      status: "not_planned",
      adaptationStatus: "not_required",
      metricsStatus: "not_applicable",
      reason: "Cost de producció alt per al senyal disponible; ajornar fins que l'angle es validi.",
      sourceContentId: "idea_ai_criterion",
      adaptation: "Cap adaptació prevista.",
      coherenceRule: "Produir només després de validar interès en canals de menor cost.",
      metricsToTrack: []
    }
  ];

  return {
    reportId: "client_report_" + Date.now(),
    clientName: "Client demo AImetos",
    period: "Últims 30 dies · actualitzat 01/08/2026",
    generatedAt: new Date().toISOString(),
    executiveSummary:
      "Les dades reals mostren dos senyals diferents: ROI aporta més abast, mentre criteri abans que tecnologia aporta més conversa i millor alineació qualitativa. Encara no hi ha leads ni reunions confirmades i la mostra continua sent petita.",
    businessObjective: "Convertir autoritat a LinkedIn en converses comercials: visites al perfil, leads qualificats i reunions.",
    strategy: {
      quarterly: "Construir autoritat en automatitzacio, IA aplicada i sistemes de decisio per PIMEs.",
      monthly: "Validar criteri humà, continuïtat operativa i qualitat d'audiència sense repetir agents o workflows en dies consecutius.",
      publication: "Alternar una peça de decisió empresarial i una de demostració tècnica, amb captures a 24h, 72h, 7 dies i 30 dies."
    },
    decision: {
      nextBestFormat: "Post LinkedIn",
      nextBestChannel: "LinkedIn",
      nextAction: "Publicar «La IA ho va dir. Ningú no ho va qüestionar» com a peça MOFU de criteri humà, amb un únic CTA de checklist.",
      confidence: realIntelligence.confidence.level,
      confidenceLabel: realIntelligence.confidence.label,
      confidenceNote:
        realIntelligence.confidence.warning
    },
    realIntelligence,
    weeklyValidation: {
      period: "21-23 juliol 2026",
      status: "initial_positive",
      summary: "Menys volum que la setmana anterior, però més conversa i millor qualitat potencial de l'audiència.",
      totals: {
        posts: 2,
        impressions: 215,
        reach: 92,
        profileVisits: 6,
        reactions: 4,
        comments: 4,
        shares: 0,
        saves: 0,
        newFollowers: 0,
        probableInvitations: 0,
        qualifiedLeads: 0,
        meetings: 0
      },
      visibilityWinner: {
        title: "No todas las empresas necesitan automatizar sus llamadas",
        reason: "117 impressions i 2 comentaris; menys abast que LI-01 però més conversa."
      },
      audienceQualityWinner: {
        title: "Automatizar no significa eliminar la atención humana",
        reason: "20% de gerents i millor alineació amb indústria i empreses mitjanes."
      },
      commercialSignal: "6 visites al perfil; 0 leads i 0 reunions confirmades.",
      nextDecision: "Mantenir la línia de criteri humà, però variar el problema i evitar repetir agents o trucades."
    },
    topContent,
    formatInsights: insights,
    recommendations,
    socialDistribution,
    calendar: recommendations.map((item, index) => ({
      day: "Setmana " + (index + 1),
      title: item.title,
      format: item.format,
      channel: item.channel,
      owner: "AImetos",
      status: index === 0 ? "ready_to_review" : "draft_needed"
    })),
    technicalStatus: {
      mode: flow.mode,
      dataSource: "Dades reals manuals/exportades: 6 LinkedIn + 5 Instagram; mock separat",
      credentialsRequiredNow: false,
      n8nWorkflowsValidated: 28
    }
  };
}

export async function runMockContentFlow(overrides: Partial<RuntimeConfig> = {}): Promise<MockFlowReport> {
  const baseConfig = loadConfig();
  const config = { ...baseConfig, ...overrides, connectors: { ...baseConfig.connectors, ...(overrides.connectors || {}) } };
  const runId = "content_flow_" + Date.now();
  const rawMetrics = readJson<MetricRecord[]>("data/fixtures/content-performance.json");
  for (const metric of rawMetrics) {
    const result = validateMetric(metric);
    if (!result.ok) {
      throw new Error("Invalid metric fixture: " + JSON.stringify(result.issues));
    }
  }
  const metrics = applyScenario(rawMetrics, config.mockScenario);
  const analysis = analyzePerformance(metrics, config);
  const generatedIdeas = generateFiveIdeas(analysis, config.mockScenario);
  for (const idea of generatedIdeas) {
    const result = validateIdea(idea);
    if (!result.ok) {
      throw new Error("Invalid generated idea: " + JSON.stringify(result.issues));
    }
  }
  const selectedIdeas = selectBestIdeas(generatedIdeas, config);
  const approvedIdeas = selectedIdeas.slice(0, Math.min(3, selectedIdeas.length)).map((idea) => ({
    ...idea,
    status: "APPROVED" as const
  }));
  const contents = approvedIdeas.map(generateContentForIdea);
  const publications = approvedIdeas.map((idea, index) =>
    publishMock(scheduleContent(idea, contents[index], "2026-07-" + String(14 + index).padStart(2, "0") + "T09:00:00.000Z"), config.mockScenario)
  );
  const connectorHealth = await Promise.all(
    buildConnectorRegistry(config).map(async (connector) => {
      const health = await connector.healthCheck();
      return { name: connector.name, status: health.status, ok: health.ok, message: health.message };
    })
  );
  const auditLog = approvedIdeas.flatMap(() =>
    transitionPath([
      "DRAFT_IDEA",
      "ANALYZED",
      "PRIORITIZED",
      "SELECTED",
      "CONTENT_DRAFTED",
      "IN_REVIEW",
      "APPROVED",
      "FORMATS_GENERATED",
      "SCHEDULED",
      "PUBLISHED",
      "METRICS_PENDING",
      "METRICS_COLLECTED",
      "ARCHIVED"
    ])
  );
  const report: MockFlowReport = {
    runId,
    mode: config.appMode,
    scenario: config.mockScenario,
    analysis,
    generatedIdeas,
    selectedIdeas,
    approvedIdeas,
    contents,
    publications,
    auditLog,
    connectorHealth,
    metricsCollected: publications.every((item) => item.status === "published"),
    report: {
      summary:
        selectedIdeas.length === 0
          ? "No idea passed the configured quality threshold."
          : "Mock flow completed with " + selectedIdeas.length + " selected ideas and " + publications.length + " publication plans.",
      recommendations: selectedIdeas.map((idea) => idea.title)
    }
  };
  return report;
}

export function writeReport(report: MockFlowReport, relPath = "data/exports/latest-report.json"): string {
  const target = rootPath(relPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(report, null, 2) + "\n", "utf8");
  return target;
}
