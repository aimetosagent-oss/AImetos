import type {
  BusinessContentScore,
  CausalConfidence,
  ConfidenceLevel,
  MarketSignal,
  MetricSnapshot,
  RealContentRecord
} from "../../shared/src/domain.ts";

export type DecisionObjective =
  | "reach"
  | "qualified_conversation"
  | "decision_makers"
  | "profile_visits"
  | "commercial_signal"
  | "technical_authority";

export type ComparableContentResult = {
  comparable: boolean;
  period?: MetricSnapshot["period"];
  confidence: "high" | "medium" | "low";
  winnerId?: string;
  reason: string;
};

export type EditorialDecisionEvidence = {
  objective: DecisionObjective;
  channel: RealContentRecord["platform"];
  comparisonPeriod?: MetricSnapshot["period"];
  maturityConfidence: "high" | "medium" | "low";
  objectiveLeaderId?: string;
  evergreenLeaderId?: string;
  temporalVisibilityLeaderId?: string;
  evidenceContentIds: string[];
};

const MATURITY_PRIORITY: MetricSnapshot["period"][] = ["7d", "72h", "24h", "48h", "30d", "latest"];

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Number(value.toFixed(1))));
}

export function latestSnapshot(record: RealContentRecord): MetricSnapshot | undefined {
  return newestValidSnapshot(record.snapshots);
}

function snapshotForPeriod(record: RealContentRecord, period: MetricSnapshot["period"]): MetricSnapshot | undefined {
  return newestValidSnapshot(record.snapshots.filter((snapshot) => snapshot.period === period));
}

export function newestValidSnapshot(snapshots: MetricSnapshot[]): MetricSnapshot | undefined {
  const valid = snapshots.filter((snapshot) => {
    if (snapshot.valid === false) return false;
    return [
      snapshot.impressions,
      snapshot.views,
      snapshot.reach,
      snapshot.reactions,
      snapshot.comments,
      snapshot.profileViews,
      snapshot.followers
    ].some((value) => typeof value === "number" && Number.isFinite(value));
  });
  return valid
    .map((snapshot, index) => ({
      snapshot,
      index,
      timestamp: snapshot.capturedAt && Number.isFinite(Date.parse(snapshot.capturedAt))
        ? Date.parse(snapshot.capturedAt)
        : Number.NEGATIVE_INFINITY
    }))
    .sort((a, b) => b.timestamp - a.timestamp || b.index - a.index)[0]?.snapshot;
}

function commonComparisonPeriod(records: RealContentRecord[]): MetricSnapshot["period"] | undefined {
  return MATURITY_PRIORITY.find(
    (period) => records.filter((record) => snapshotForPeriod(record, period)).length >= 2
  );
}

function maturityConfidence(period?: MetricSnapshot["period"]): "high" | "medium" | "low" {
  if (period === "7d" || period === "30d") return "high";
  if (period === "72h") return "medium";
  return "low";
}

function objectiveValue(
  record: RealContentRecord,
  snapshot: MetricSnapshot,
  objective: DecisionObjective
): number {
  if (objective === "reach") return snapshot.reach || snapshot.impressions || snapshot.views || 0;
  if (objective === "qualified_conversation") {
    return (snapshot.comments || 0) * 5 + (snapshot.shares || 0) * 4 + (snapshot.saves || 0) * 3 + (snapshot.profileViews || 0);
  }
  if (objective === "decision_makers") return record.audience?.decisionMakersPercent || 0;
  if (objective === "profile_visits") return snapshot.profileViews || 0;
  if (objective === "commercial_signal") {
    return (snapshot.qualifiedLeads || 0) * 10 + (snapshot.meetings || 0) * 20 + (snapshot.messagesReceived || 0) * 4;
  }
  return (snapshot.comments || 0) * 3 + (snapshot.saves || 0) * 2 + (record.editorialFamily === "technical_robustness" ? 2 : 0);
}

export function comparePostsAtSameMaturity(
  first: RealContentRecord,
  second: RealContentRecord,
  objective: DecisionObjective
): ComparableContentResult {
  const period = MATURITY_PRIORITY.find(
    (candidate) => snapshotForPeriod(first, candidate) && snapshotForPeriod(second, candidate)
  );
  if (!period) {
    return {
      comparable: false,
      confidence: "low",
      reason: "Les publicacions no tenen cap finestra de maduració equivalent; no es declara cap guanyador."
    };
  }
  const firstValue = objectiveValue(first, snapshotForPeriod(first, period)!, objective);
  const secondValue = objectiveValue(second, snapshotForPeriod(second, period)!, objective);
  return {
    comparable: true,
    period,
    confidence: maturityConfidence(period),
    winnerId: firstValue === secondValue ? undefined : firstValue > secondValue ? first.id : second.id,
    reason: `Comparació homogènia ${period} vs ${period} per a l'objectiu ${objective}.`
  };
}

export function evaluateCausalTest(record: RealContentRecord): {
  multivariableTest: boolean;
  causalConfidence: CausalConfidence;
} {
  const changedVariables = record.changedVariables || [];
  if (changedVariables.length > 1 || record.multivariable_test) {
    return { multivariableTest: true, causalConfidence: "low" };
  }
  if (changedVariables.length === 1) return { multivariableTest: false, causalConfidence: "medium" };
  return { multivariableTest: false, causalConfidence: record.causal_confidence || "low" };
}

export function audienceEvidenceConfidence(record: RealContentRecord): "high" | "medium" | "low" {
  if (!record.audience) return "low";
  if (record.sourceType === "real_export") return "high";
  if (record.sourceType === "real_screenshot") return "medium";
  return "low";
}

export function determineCurrentObjective(records: RealContentRecord[]): DecisionObjective {
  const linkedin = records.filter((record) => record.platform === "linkedin" && record.comparable !== false);
  const snapshots = linkedin.map(latestSnapshot).filter((snapshot): snapshot is MetricSnapshot => Boolean(snapshot));
  const leads = snapshots.reduce((total, snapshot) => total + (snapshot.qualifiedLeads || 0), 0);
  const meetings = snapshots.reduce((total, snapshot) => total + (snapshot.meetings || 0), 0);
  const profileViews = snapshots.reduce((total, snapshot) => total + (snapshot.profileViews || 0), 0);
  if (leads === 0 && meetings === 0 && profileViews > 0) return "qualified_conversation";
  return leads > 0 || meetings > 0 ? "commercial_signal" : "reach";
}

export function buildEditorialDecisionEvidence(
  records: RealContentRecord[],
  objective: DecisionObjective,
  channel: RealContentRecord["platform"] = "linkedin"
): EditorialDecisionEvidence {
  const channelRecords = records.filter(
    (record) => record.platform === channel && record.comparable !== false && record.snapshots.length > 0
  );
  const period = commonComparisonPeriod(channelRecords);
  const comparable = period
    ? channelRecords.filter((record) => snapshotForPeriod(record, period))
    : [];
  const ranked = [...comparable].sort(
    (a, b) => objectiveValue(b, snapshotForPeriod(b, period!)!, objective) - objectiveValue(a, snapshotForPeriod(a, period!)!, objective)
  );
  const evergreen = ranked.find((record) => record.contentNature !== "temporal");
  const temporalVisibility = [...channelRecords]
    .filter((record) => record.contentNature === "temporal")
    .sort((a, b) => (latestSnapshot(b)?.impressions || 0) - (latestSnapshot(a)?.impressions || 0))[0];
  return {
    objective,
    channel,
    comparisonPeriod: period,
    maturityConfidence: maturityConfidence(period),
    objectiveLeaderId: ranked[0]?.id,
    evergreenLeaderId: evergreen?.id,
    temporalVisibilityLeaderId: temporalVisibility?.id,
    evidenceContentIds: comparable.map((record) => record.id)
  };
}

export function confidenceFromSample(comparablePosts: number): ConfidenceLevel {
  if (comparablePosts === 0) return "insufficient_data";
  if (comparablePosts < 3) return "early_signal";
  if (comparablePosts < 12) return "developing_pattern";
  if (comparablePosts < 20) return "moderate_confidence";
  return "high_confidence";
}

function sampleConfidence(comparablePosts: number): number {
  if (comparablePosts === 0) return 0;
  if (comparablePosts < 3) return 35;
  if (comparablePosts < 12) return 55;
  if (comparablePosts < 20) return 75;
  return 100;
}

function normalized(value: number, maximum: number): number {
  return maximum <= 0 ? 0 : clamp((value / maximum) * 100);
}

function sum(snapshot: MetricSnapshot | undefined, fields: Array<keyof MetricSnapshot>): number {
  if (!snapshot) return 0;
  return fields.reduce((total, field) => total + (typeof snapshot[field] === "number" ? Number(snapshot[field]) : 0), 0);
}

export function scoreRealContent(
  record: RealContentRecord,
  comparable: RealContentRecord[],
  marketSignals: MarketSignal[] = [],
  comparisonPeriod?: MetricSnapshot["period"]
): BusinessContentScore {
  const snapshot = comparisonPeriod ? snapshotForPeriod(record, comparisonPeriod) : latestSnapshot(record);
  const snapshots = comparable
    .filter((item) => item.comparable !== false)
    .map((item) => comparisonPeriod ? snapshotForPeriod(item, comparisonPeriod) : latestSnapshot(item))
    .filter((item): item is MetricSnapshot => Boolean(item));
  const exposure = snapshot?.impressions || snapshot?.views || 0;
  const maxExposure = Math.max(0, ...snapshots.map((item) => item.impressions || item.views || 0));
  const maxProfileViews = Math.max(0, ...snapshots.map((item) => item.profileViews || 0));
  const reactions = snapshot?.reactions || 0;
  const comments = snapshot?.comments || 0;
  const shares = snapshot?.shares || 0;
  const saves = snapshot?.saves || 0;
  const engagementRate = exposure === 0 ? 0 : ((reactions + comments * 2 + shares * 3 + saves * 2) / exposure) * 100;
  const maxEngagementRate = Math.max(
    0,
    ...snapshots.map((item) => {
      const base = item.impressions || item.views || 0;
      return base === 0
        ? 0
        : (((item.reactions || 0) + (item.comments || 0) * 2 + (item.shares || 0) * 3 + (item.saves || 0) * 2) / base) * 100;
    })
  );
  const probableConnections = snapshot?.attributionConfidence === "probable" ? snapshot.connectionRequestsAttributed || 0 : 0;
  const confirmedCommercial = sum(snapshot, ["messagesReceived", "qualifiedLeads", "meetings", "proposals", "opportunities"]);
  const decisionMaker = clamp((record.audience?.decisionMakersPercent || 0) * 3);
  const audienceFit = clamp(
    (record.audience?.prioritySectors?.length || 0) * 25 +
      (record.audience?.companySizes?.length || 0) * 10 +
      (record.audience?.locations?.length || 0) * 5
  );
  const matchingSignals = marketSignals.filter((signal) => {
    const haystack = `${record.topic} ${record.editorialAngle}`.toLowerCase();
    return haystack.includes(signal.affectedTopic.toLowerCase()) || signal.editorialImplication.toLowerCase().includes(record.editorialAngle.toLowerCase());
  });
  const marketSignal = clamp(matchingSignals.reduce((total, signal) => total + signal.strength * 15, 0));
  const conversation = normalized(comments * 2 + shares * 3, Math.max(1, ...snapshots.map((item) => (item.comments || 0) * 2 + (item.shares || 0) * 3)));
  const commercialSignal = clamp(
    confirmedCommercial * 35 +
      (snapshot?.followers || 0) * 15 +
      (snapshot?.decisionMakerConnections || 0) * 15 +
      probableConnections * 10
  );
  const authority = clamp(conversation * 0.55 + audienceFit * 0.25 + marketSignal * 0.2);
  const differentiation = clamp(55 + marketSignal * 0.35 + (record.editorialAngle.includes("criteri") ? 15 : 0));
  const reusability = clamp(record.format.includes("post") ? 80 : 65);
  const comparablePosts = snapshots.length;
  const sample = sampleConfidence(comparablePosts);
  const breakdown = {
    reach: normalized(exposure, maxExposure),
    engagement: normalized(engagementRate, maxEngagementRate),
    profileInterest: normalized(snapshot?.profileViews || 0, maxProfileViews),
    decisionMaker,
    audienceFit,
    conversation,
    commercialSignal,
    authority,
    differentiation,
    reusability,
    marketSignal,
    sampleConfidence: sample
  };
  const raw =
    breakdown.decisionMaker * 0.2 +
    breakdown.profileInterest * 0.15 +
    breakdown.conversation * 0.15 +
    breakdown.commercialSignal * 0.15 +
    breakdown.reach * 0.1 +
    breakdown.engagement * 0.05 +
    breakdown.differentiation * 0.1 +
    breakdown.authority * 0.05 +
    breakdown.reusability * 0.05;
  const total = clamp(raw * (0.55 + sample * 0.0045));
  const explanation =
    record.status === "low_performance_early_result"
      ? "Resultat inicial baix. Es conserva com a dada, però una sola publicació no invalida el contingut tècnic."
      : `Combina abast ${Math.round(breakdown.reach)}/100, conversa ${Math.round(breakdown.conversation)}/100, qualitat d'audiència ${Math.round(breakdown.decisionMaker)}/100 i senyal comercial ${Math.round(breakdown.commercialSignal)}/100.`;

  return {
    total,
    confidence: confidenceFromSample(comparablePosts),
    comparablePosts,
    breakdown,
    explanation
  };
}

export function rankRealContent(records: RealContentRecord[], marketSignals: MarketSignal[] = []) {
  const measured = records.filter((record) => record.comparable !== false && latestSnapshot(record));
  const cohorts = [...new Set(measured.map((record) => record.platform))].flatMap((platform) => {
    const channelRecords = measured.filter((record) => record.platform === platform);
    const period = commonComparisonPeriod(channelRecords);
    if (!period) return [];
    const comparable = channelRecords.filter((record) => snapshotForPeriod(record, period));
    return comparable.map((record) => ({
      record,
      score: scoreRealContent(record, comparable, marketSignals, period)
    }));
  });
  return cohorts
    .sort((a, b) => b.score.total - a.score.total);
}
