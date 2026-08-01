import type {
  BusinessContentScore,
  ConfidenceLevel,
  MarketSignal,
  MetricSnapshot,
  RealContentRecord
} from "../../shared/src/domain.ts";

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Number(value.toFixed(1))));
}

export function latestSnapshot(record: RealContentRecord): MetricSnapshot | undefined {
  return record.snapshots.at(-1);
}

export function confidenceFromSample(comparablePosts: number): ConfidenceLevel {
  if (comparablePosts === 0) return "insufficient_data";
  if (comparablePosts < 3) return "early_signal";
  if (comparablePosts < 6) return "developing_pattern";
  if (comparablePosts < 12) return "moderate_confidence";
  return "high_confidence";
}

function sampleConfidence(comparablePosts: number): number {
  if (comparablePosts === 0) return 0;
  if (comparablePosts < 3) return 35;
  if (comparablePosts < 6) return 55;
  if (comparablePosts < 12) return 75;
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
  marketSignals: MarketSignal[] = []
): BusinessContentScore {
  const snapshot = latestSnapshot(record);
  const snapshots = comparable.map(latestSnapshot).filter((item): item is MetricSnapshot => Boolean(item));
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
  const measured = records.filter((record) => latestSnapshot(record));
  return measured
    .map((record) => ({ record, score: scoreRealContent(record, measured.filter((item) => item.platform === record.platform), marketSignals) }))
    .sort((a, b) => b.score.total - a.score.total);
}
