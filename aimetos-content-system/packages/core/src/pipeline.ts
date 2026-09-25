import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BusinessContentScore,
  ContentIdea,
  DataSourceType,
  EditorialCalendar,
  EditorialMemoryItem,
  MarketSignal,
  MetricRecord,
  RealContentRecord
} from "../../shared/src/domain.ts";
import { loadConfig, type RuntimeConfig } from "../../config/src/env.ts";
import { analyzePerformance } from "../../analytics/src/performance.ts";
import {
  confidenceFromSample,
  determineCurrentObjective,
  evaluateCausalTest,
  latestSnapshot,
  rankRealContent,
  type DecisionObjective
} from "../../analytics/src/business-content.ts";
import {
  analyzePublicationTiming,
  type PublicationTimingAnalysis,
  type TimingTestStrategy
} from "../../analytics/src/publication-timing.ts";
import { generateFiveIdeas, selectBestIdeas } from "../../strategy/src/ideation.ts";
import { resolveTemporalContext, type TemporalDecisionContext } from "../../strategy/src/editorial-calendar.ts";
import { generateContentForIdea } from "../../content/src/generator.ts";
import { publishMock, scheduleContent } from "../../publishing/src/scheduler.ts";
import { buildConnectorRegistry } from "../../connectors/src/registry.ts";
import { transitionPath } from "./state-machine.ts";
import { validateIdea, validateMetric } from "../../validation/src/schemas.ts";
import {
  buildEditorialState,
  type EditorialControlState,
  type EditorialState
} from "./editorial-state.ts";
import {
  buildContentDecision,
  DEFAULT_EDITORIAL_CANDIDATES,
  type ContentDecision,
  type EditorialCandidate
} from "./content-decision-engine.ts";

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
  temporalContext: TemporalDecisionContext;
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
  publishTimeLabel: "Hora recomanada actual" | "Millor hora per publicar";
  timing_confidence: PublicationTimingAnalysis["timing_confidence"];
  timing_reason: string;
  timing_strategy: TimingTestStrategy;
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
  editorialFamily: ContentIdea["editorialFamily"];
  editorialVariety: {
    lastUsedAt?: string;
    appearancesLast4Posts: number;
    repetitionPenalty: number;
    diversityBonus: number;
    temporalBonus: number;
  };
  expandToArticle: boolean;
  learningObjective?: string;
  experiment?: ContentDecision["experiment"];
  confidence?: ContentDecision["confidence"];
};

export type ClientMonthlyReport = {
  reportId: string;
  clientName: string;
  period: string;
  generatedAt: string;
  executiveSummary: string;
  executiveReading: string[];
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
    recommendationLevel: "alta" | "mitjana" | "baixa";
    publishDate: string;
    channels: string[];
    justification: string;
    comparablePosts: number;
    temporalContext?: string;
    timing_confidence: PublicationTimingAnalysis["timing_confidence"];
    timing_reason: string;
    testObjective: DecisionObjective;
    evidenceWindow?: string;
    multivariableTest: boolean;
    causalConfidence: "high" | "medium" | "low";
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
      interactions: number;
      profileVisits: number;
      bioLinkTaps: number;
      followersViewsPercent: number;
      nonFollowersViewsPercent: number;
      bestReach: string;
      bestRelativeEngagement: string;
      warning: string;
      facebookBusinessStatus: "pending" | "available";
    };
    marketSignals: MarketSignal[];
    editorialMemory: EditorialMemoryItem[];
    dataStates: Array<{ sourceType: string; count: number }>;
    dataQuality: {
      baselineContentId: string;
      conflicts: Array<{ contentId: string; note: string }>;
      pendingContentIds: string[];
      snapshotInventory: Array<{ contentId: string; count: number; latestLabel: string }>;
      causalTests: Array<{ contentId: string; multivariableTest: boolean; causalConfidence: "high" | "medium" | "low" }>;
    };
    timing: PublicationTimingAnalysis;
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
    channel: "linkedin" | "meta" | "facebook_personal" | "blog" | "newsletter" | "youtube";
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
    platformMetrics?: {
      instagram: string[];
      facebookBusiness: string[];
    };
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
    chatEnabled: boolean;
    chatProvider: "mock" | "openai";
  };
  editorialState: EditorialState;
  contentDecision: ContentDecision;
};

type PlatformSnapshotData = {
  dataCutoff?: string;
  linkedin: {
    rolling28DaySnapshots: Array<{
      capturedAt: string;
      impressions: number;
      reach: number;
      reactions: number;
      comments: number;
      followersTotal: number;
      outOfNetworkPercent: number;
      shares?: number;
      saves?: number;
      sends?: number;
      profileViews?: number;
    }>;
    rolling90DaySnapshots?: Array<{
      capturedAt: string;
      impressions: number;
      reach: number;
      reactions: number;
      comments: number;
      followersTotal: number;
      outOfNetworkPercent: number;
      shares?: number;
      saves?: number;
      sends?: number;
      profileViews?: number;
    }>;
    currentAudienceViews?: Array<Record<string, unknown>>;
  };
  instagram: {
    rolling30DaySnapshots: Array<{
      capturedAt: string;
      views: number;
      interactions: number;
      followersViewsPercent?: number;
      nonFollowersViewsPercent?: number;
      profileVisits?: number;
      bioLinkTaps?: number;
    }>;
    topVisibleContent: Array<{ title: string; views: number }>;
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
  sourceType: DataSourceType;
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
  editorialMemory: EditorialMemoryItem[],
  platformSnapshots: PlatformSnapshotData
): ClientMonthlyReport["realIntelligence"] {
  const linkedin = records.filter((record) => record.platform === "linkedin");
  const instagram = records.filter((record) => record.platform === "instagram");
  const facebookBusiness = records.filter((record) => record.platform === "facebook");
  const measured = records.filter((record) => record.comparable !== false && latestSnapshot(record));
  const linkedinMeasured = linkedin.filter((record) => record.comparable !== false && latestSnapshot(record));
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
  const audienceRecords = linkedin.filter((record) => record.comparable !== false && record.audience);
  const sectors = [...new Set(audienceRecords.flatMap((record) => record.audience?.prioritySectors || []))];
  const companySizes = [...new Set(audienceRecords.flatMap((record) => record.audience?.companySizes?.map((item) => item.label) || []))];
  const locations = [...new Set(audienceRecords.flatMap((record) => record.audience?.locations?.map((item) => item.label) || []))];
  const decisionMakerPeak = Math.max(0, ...audienceRecords.map((record) => record.audience?.decisionMakersPercent || 0));
  const instagramSnapshots = instagram.map(latestSnapshot).filter((item): item is NonNullable<ReturnType<typeof latestSnapshot>> => Boolean(item));
  const igViews = instagramSnapshots.reduce((total, snapshot) => total + (snapshot.views || 0), 0);
  const igReactions = instagramSnapshots.reduce((total, snapshot) => total + (snapshot.reactions || 0), 0);
  const sourceCounts = new Map<string, number>();
  for (const record of records) sourceCounts.set(record.sourceType, (sourceCounts.get(record.sourceType) || 0) + 1);
  const currentLinkedIn = [
    ...platformSnapshots.linkedin.rolling28DaySnapshots,
    ...(platformSnapshots.linkedin.rolling90DaySnapshots || [])
  ].sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt)).at(-1);
  const currentInstagram = platformSnapshots.instagram.rolling30DaySnapshots.at(-1);
  const bestInstagram = platformSnapshots.instagram.topVisibleContent[0];

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
      impressions: currentLinkedIn?.impressions || linkedinMeasured.reduce((total, record) => total + (latestSnapshot(record)?.impressions || 0), 0),
      reach: currentLinkedIn?.reach || linkedinMeasured.reduce((total, record) => total + (latestSnapshot(record)?.reach || 0), 0),
      profileViews: currentLinkedIn?.profileViews || sumField("profileViews"),
      reactions: currentLinkedIn?.reactions || sumField("reactions"),
      comments: currentLinkedIn?.comments || sumField("comments"),
      followers: currentLinkedIn?.followersTotal || sumField("followers"),
      probableInvitations: snapshots.reduce(
        (total, snapshot) => total + (snapshot.attributionConfidence === "probable" ? snapshot.connectionRequestsAttributed || 0 : 0),
        0
      ),
      confirmedLeads: sumField("qualifiedLeads"),
      meetings: sumField("meetings")
    },
    winners: [
      { key: "reach", label: "Millor visibilitat recent madura", contentId: "LI-16", title: linkedin.find((record) => record.id === "LI-16")?.title || "-", reason: "267 impressions, 163 persones assolides i 6 visites al perfil a 7 dies." },
      { key: "conversation", label: "Millor conversa recent", contentId: "LI-16", title: linkedin.find((record) => record.id === "LI-16")?.title || "-", reason: "3 comentaris i una conversa substantiva sobre dades contradictòries i incertesa." },
      { key: "audience", label: "Millor authority fit recent", contentId: "LI-16", title: linkedin.find((record) => record.id === "LI-16")?.title || "-", reason: "10% Director de projecte i proximitat amb l'experiència professional de Roger; és una hipòtesi en desenvolupament." },
      { key: "commercial", label: "Millor senyal comercial recent", contentId: "LI-13", title: linkedin.find((record) => record.id === "LI-13")?.title || "-", reason: "2 visites al perfil al primer export. És curiositat comercial, no un lead confirmat." },
      { key: "worst", label: "Resultat provisional més modest", contentId: "LI-17", title: linkedin.find((record) => record.id === "LI-17")?.title || "-", reason: "76 impressions i 0 interaccions a ~43 h, però 2 visites al perfil. Encara no és comparable a 7 dies." },
      { key: "maturation", label: "Major maduració després de 24 h", contentId: "LI-16", title: linkedin.find((record) => record.id === "LI-16")?.title || "-", reason: "Va passar de 110 impressions a 24 h a 267 a 7 dies; els comentaris van aparèixer després del primer snapshot." },
      { key: "instagram", label: "Millor abast visible Instagram", contentId: "IG-LI-09", title: bestInstagram?.title || "-", reason: `${bestInstagram?.views || 0} visualitzacions i 1 repost visible; mostra encara molt petita.` }
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
      { period: "1-3 setembre", impressions: 226, reach: 146, profileViews: 3, reactions: 4, comments: 2, reading: "Email va madurar de 64 a 145 i seguiment comercial va portar 2 visites al perfil; les finestres finals no són exactament equivalents." },
      { period: "9-15 setembre", impressions: 181, reach: 108, profileViews: 3, reactions: 6, comments: 1, reading: "Reporting mostra bona densitat d'interacció i factures interès proporcional al perfil, sense propagació." },
      { period: "17-24 setembre", impressions: 343, reach: 201, profileViews: 8, reactions: 3, comments: 3, reading: "PM ja és comparable a 7 dies; aprovacions encara és provisional. No atribuir la diferència a l'hora." }
    ],
    instagram: {
      posts: instagram.length,
      views: currentInstagram?.views || igViews,
      reactions: igReactions,
      interactions: currentInstagram?.interactions || 0,
      profileVisits: currentInstagram?.profileVisits || 0,
      bioLinkTaps: currentInstagram?.bioLinkTaps || 0,
      followersViewsPercent: currentInstagram?.followersViewsPercent || 0,
      nonFollowersViewsPercent: currentInstagram?.nonFollowersViewsPercent || 0,
      bestReach: `${bestInstagram?.title || "-"} · ${bestInstagram?.views || 0} visualitzacions`,
      bestRelativeEngagement: "IG-03 · 3 m'agrada / 7 visualitzacions",
      warning: "Mostra molt petita: cap comentari, compartició o enviament. No hi ha patró ferm.",
      facebookBusinessStatus: facebookBusiness.some((record) => record.metricsStatus === "available") ? "available" : "pending"
    },
    marketSignals,
    editorialMemory,
    dataStates: [...sourceCounts.entries()].map(([sourceType, count]) => ({ sourceType, count })),
    dataQuality: {
      baselineContentId: records.find((record) => record.isBaseline)?.id || "-",
      conflicts: records
        .filter((record) => record.publishedAtConflict)
        .map((record) => ({ contentId: record.id, note: record.dataNote || "Conflicte pendent de resoldre." })),
      pendingContentIds: records.filter((record) => record.metricsStatus === "pending").map((record) => record.id),
      snapshotInventory: records.map((record) => ({
        contentId: record.id,
        count: record.snapshots.length,
        latestLabel: record.snapshots.at(-1)?.snapshotLabel || record.snapshots.at(-1)?.period || "pending"
      })),
      causalTests: records
        .filter((record) => record.changedVariables?.length || record.multivariable_test)
        .map((record) => ({ contentId: record.id, ...evaluateCausalTest(record) }))
    },
    timing: analyzePublicationTiming(records)
  };
}

export function loadRealContentWithManualEntries(): RealContentRecord[] {
  const realContent = readJson<RealContentRecord[]>("data/fixtures/real-content.json");
  const manualEntries = readJson<ManualMetricEntry[]>("data/fixtures/manual-metric-entries.json");
  return realContent.map((record) => ({
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
}

export async function buildClientMonthlyReport(
  overrides: Partial<RuntimeConfig> = {},
  options: { controlState?: EditorialControlState; now?: Date; realContentRecords?: RealContentRecord[] } = {}
): Promise<ClientMonthlyReport> {
  const flow = await runMockContentFlow(overrides);
  const rawMetrics = readJson<MetricRecord[]>("data/fixtures/content-performance.json");
  const linkedInPosts = readJson<LinkedInPostInput[]>("data/fixtures/linkedin-posts.json");
  const mergedRealContent = options.realContentRecords || loadRealContentWithManualEntries();
  const marketSignals = readJson<MarketSignal[]>("data/fixtures/market-signals.json");
  const editorialMemory = readJson<EditorialMemoryItem[]>("data/fixtures/editorial-memory.json");
  const platformSnapshots = readJson<PlatformSnapshotData>("data/fixtures/platform-snapshots.json");
  const editorialState = buildEditorialState({
    records: mergedRealContent,
    marketSignals,
    editorialMemory,
    platformSnapshots,
    controlState: options.controlState,
    now: options.now
  });
  const contentDecision = buildContentDecision({
    state: editorialState,
    records: mergedRealContent,
    excludedCandidateIds: options.controlState?.excludedCandidateIds
  });
  const realIntelligence = buildRealIntelligence(mergedRealContent, marketSignals, editorialMemory, platformSnapshots);
  const testObjective = determineCurrentObjective(mergedRealContent);
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
  const metricsToTrack = contentDecision.metrics_to_watch;
  const candidateById = new Map(DEFAULT_EDITORIAL_CANDIDATES.map((candidate) => [candidate.id, candidate]));
  const selectedCandidate = candidateById.get(contentDecision.candidate_id) || DEFAULT_EDITORIAL_CANDIDATES[0];
  const recommendationCandidates = [
    selectedCandidate,
    ...contentDecision.alternatives
      .filter((alternative) => alternative.status === "eligible")
      .map((alternative) => candidateById.get(alternative.candidate_id))
      .filter((candidate): candidate is EditorialCandidate => Boolean(candidate))
  ].slice(0, 3);
  const dateParts = contentDecision.recommended_date.split("-");
  const publishMoment = `Dimarts ${dateParts[2]}/${dateParts[1]} a les ${contentDecision.recommended_time}`;
  const recommendations = recommendationCandidates.map((candidate, index): ClientContentRecommendation => {
    const alternative = contentDecision.alternatives.find((item) => item.candidate_id === candidate.id);
    return {
      title: candidate.title,
      format: candidate.format,
      channel: "linkedin",
      displayFormat: candidate.display_format,
      displayChannel: "LinkedIn",
      reason: index === 0 ? contentDecision.reason_to_publish : alternative?.reason || candidate.source,
      recommended: index === 0,
      whyRecommended: index === 0
        ? `${contentDecision.reason_to_publish} Objectiu d'aprenentatge: ${contentDecision.learning_objective}.`
        : alternative?.reason || candidate.source,
      hook: candidate.hook,
      postCopy: candidate.post_copy,
      bestPublishTime: publishMoment,
      publishTimeLabel: contentDecision.timing_label,
      timing_confidence: realIntelligence.timing.timing_confidence,
      timing_reason: `${editorialState.timing_reason} Es manté la franja baseline per aïllar la variable editorial principal.`,
      timing_strategy: "maintain_time",
      metricsToTrack: candidate.metrics_to_watch,
      publicationStatus: "pending_publish",
      productionBrief: candidate.visual_brief,
      visualBrief: candidate.visual_brief,
      imageAsset: "",
      imagePrompt: candidate.image_prompt,
      cta: candidate.cta,
      effort: candidate.format === "image_post" ? "low" : candidate.format === "document_carousel" ? "medium" : "high",
      targetCustomer: candidate.target_customer,
      concreteProblem: candidate.concrete_problem,
      funnelStage: candidate.funnel_stage,
      singleObjective: candidate.objective,
      businessConsequence: candidate.expected_signal,
      proofOrExample: candidate.source,
      editorialFamily: candidate.family,
      editorialVariety: {
        appearancesLast4Posts: editorialState.recent_posts.slice(0, 4).filter((post) => post.family === candidate.family).length,
        repetitionPenalty: 0,
        diversityBonus: editorialState.recent_posts.slice(0, 4).some((post) => post.family === candidate.family) ? 0 : 14,
        temporalBonus: 0
      },
      expandToArticle: false,
      learningObjective: candidate.learning_objective,
      experiment: index === 0 ? contentDecision.experiment : undefined,
      confidence: index === 0 ? contentDecision.confidence : undefined
    };
  });
  const primaryIdea = selectedCandidate;
  const primaryIdeaId = primaryIdea.id;
  const blogEligible = false;
  const socialDistribution: ClientMonthlyReport["socialDistribution"] = [
    {
      channel: "linkedin",
      label: "LinkedIn",
      recommendedScore: 92,
      recommended: true,
      recommendation: "publish_now",
      format: "Post amb imatge",
      publishTime: "Dimarts a les 08:40",
      status: "pending_publish",
      adaptationStatus: "ready",
      metricsStatus: "pending",
      reason: "Canal principal B2B i única xarxa amb senyals de conversa i qualitat d'audiència.",
      sourceContentId: primaryIdeaId,
      adaptation: primaryIdea.post_copy,
      coherenceRule: "Un client, un problema, una fase MOFU, un objectiu i un CTA.",
      metricsToTrack
    },
    {
      channel: "meta",
      label: "Meta",
      recommendedScore: 70,
      recommended: true,
      recommendation: "adapt_and_publish",
      format: "Instagram + Facebook empresa",
      publishTime: "Dimecres a les 12:30",
      status: "pending_publish",
      adaptationStatus: "draft_needed",
      metricsStatus: "pending",
      reason: "Instagram i Facebook empresa es publiquen sincronitzats amb una única acció.",
      sourceContentId: primaryIdeaId,
      adaptation: "Mateix text, creativitat, data i hora per a Instagram i Facebook empresa.",
      coherenceRule: "Una única peça Meta coherent amb la idea principal de LinkedIn.",
      metricsToTrack: ["Visualitzacions", "Abast", "Interaccions", "Clics", "Missatges"],
      platformMetrics: {
        instagram: ["Visualitzacions", "M'agrada", "Comentaris", "Comparticions", "Desats"],
        facebookBusiness: ["Abast", "Reaccions", "Comentaris", "Comparticions", "Clics", "Missatges"]
      }
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
      sourceContentId: primaryIdeaId,
      adaptation: "Cap adaptació prevista.",
      coherenceRule: "Publicar només quan hi hagi context personal rellevant.",
      metricsToTrack: []
    },
    {
      channel: "blog",
      label: "Blog",
      recommendedScore: blogEligible ? 65 : 30,
      recommended: blogEligible,
      recommendation: blogEligible ? "adapt_and_publish" : "not_recommended",
      format: blogEligible ? "Article de criteri" : "No planificat",
      publishTime: blogEligible ? "Setmana següent" : "-",
      status: blogEligible ? "pending_publish" : "not_planned",
      adaptationStatus: blogEligible ? "draft_needed" : "not_required",
      metricsStatus: blogEligible ? "pending" : "not_applicable",
      reason: blogEligible
        ? "El tema pot aportar profunditat, rellevància comercial i enllaç intern útil."
        : "La peça temporal no genera article per defecte; només s'ampliaria com a contingut evergreen de continuïtat operativa.",
      sourceContentId: primaryIdeaId,
      adaptation: blogEligible ? "Ampliació editorial pendent d'aprovació." : "Cap article automàtic.",
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
      sourceContentId: primaryIdeaId,
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
      sourceContentId: primaryIdeaId,
      adaptation: "Cap adaptació prevista.",
      coherenceRule: "Produir només després de validar interès en canals de menor cost.",
      metricsToTrack: []
    }
  ];

  return {
    reportId: "client_report_" + Date.now(),
    clientName: "Client demo AImetos",
    period: "Dades disponibles fins al 24/09/2026",
    generatedAt: (options.now || new Date()).toISOString(),
    executiveSummary:
      "Project Management ha madurat fins a convertir-se en una de les peces més fortes, mentre que aprovacions encara és un senyal provisional. La següent decisió prioritza un cas comercial real i una sola variable experimental.",
    executiveReading: [
      "Project Management va passar de 110 impressions a 24 h a 267 a 7 dies, amb 3 comentaris i 1 guardat: la maduració canvia la lectura.",
      "Aprovacions té 76 impressions a ~43 h i és el primer test deliberat de tarda; no permet concloure que 17–20 funcioni millor o pitjor.",
      "El snapshot agregat arriba a 3.339 impressions, 670 membres assolits, 13 comentaris, 1 guardat i 1 enviament; les comparticions continuen a 0.",
      "Encara hi ha 0 leads i 0 reunions confirmades. La propera prova valida un cas comercial real, no una promesa de conversió."
    ],
    businessObjective: "Convertir autoritat a LinkedIn en converses comercials: visites al perfil, leads qualificats i reunions.",
    strategy: {
      quarterly: "Construir autoritat en automatització, IA aplicada i sistemes de decisió per a PIMEs.",
      monthly: "Combinar casos reals amb aprenentatge mesurable, diversitat editorial i senyals comercials honestos.",
      publication: `Publicar ${contentDecision.weekly_cadence} peça aquesta setmana, mantenir hora, format i visual baseline, i provar principalment el tema.`
    },
    decision: {
      nextBestFormat: "Post LinkedIn",
      nextBestChannel: "LinkedIn + Meta",
      nextAction: contentDecision.publish ? contentDecision.hook : "Aquesta setmana no hi ha una proposta prou forta",
      confidence: realIntelligence.confidence.level,
      confidenceLabel: realIntelligence.confidence.label,
      confidenceNote:
        realIntelligence.confidence.warning,
      recommendationLevel: "alta",
      publishDate: contentDecision.recommended_date.split("-").reverse().join("/"),
      channels: ["LinkedIn", "Meta"],
      justification: contentDecision.reason_to_publish,
      comparablePosts: realIntelligence.confidence.comparablePosts,
      temporalContext: recommendations[0]?.editorialVariety.temporalBonus > 0 ? flow.temporalContext.badge : undefined,
      timing_confidence: realIntelligence.timing.timing_confidence,
      timing_reason: recommendations[0]?.timing_reason || realIntelligence.timing.timing_reason,
      testObjective,
      evidenceWindow: "7d",
      multivariableTest: false,
      causalConfidence: "medium"
    },
    realIntelligence,
    weeklyValidation: {
      period: "17-24 setembre 2026",
      status: "initial_positive",
      summary: "Project Management ja té lectura a 7 dies; aprovacions continua provisional. Les dues xifres es mostren juntes, però no es comparen com si tinguessin la mateixa maduració.",
      totals: {
        posts: 2,
        impressions: 343,
        reach: 201,
        profileVisits: 8,
        reactions: 3,
        comments: 3,
        shares: 0,
        saves: 1,
        newFollowers: 0,
        probableInvitations: 0,
        qualifiedLeads: 0,
        meetings: 0
      },
      visibilityWinner: {
        title: "Un Project Manager no debería pasar el viernes persiguiendo actualizaciones de estado.",
        reason: "267 impressions, 163 persones assolides i 6 visites al perfil a 7 dies; va créixer molt després de 24 h."
      },
      audienceQualityWinner: {
        title: "Un Project Manager no debería pasar el viernes persiguiendo actualizaciones de estado.",
        reason: "10% Director de projecte i un comentari substantiu d'un altre PM; authority fit prometedor, encara no causal."
      },
      commercialSignal: "8 visites al perfil entre les dues peces; 0 leads i 0 reunions confirmades.",
      nextDecision: contentDecision.reason_to_publish
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
      dataSource: "Dades reals fins al 24/09: històric LinkedIn, snapshots individuals i agregats, Instagram complementari i Facebook empresa pendent",
      credentialsRequiredNow: false,
      n8nWorkflowsValidated: 28,
      chatEnabled: config.chatEnabled,
      chatProvider: config.chatProvider
    },
    editorialState,
    contentDecision
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
  const editorialCalendar = readJson<EditorialCalendar>("config/editorial-calendar.json");
  const realContent = readJson<RealContentRecord[]>("data/fixtures/real-content.json");
  const temporalContext = resolveTemporalContext(editorialCalendar);
  const generatedIdeas = generateFiveIdeas(analysis, config.mockScenario, temporalContext, realContent);
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
    temporalContext,
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
