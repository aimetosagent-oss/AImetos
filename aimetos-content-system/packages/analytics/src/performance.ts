import type { MetricRecord } from "../../shared/src/domain.ts";
import type { RuntimeConfig } from "../../config/src/env.ts";

export type MetricWindowSummary = {
  count: number;
  impressions: number;
  clicks: number;
  leads: number;
  qualifiedLeads: number;
  meetings: number;
  revenue: number;
  cost: number;
  averageCtr: number;
  averageRetention: number;
  roi: number;
};

export type PerformanceAnalysis = {
  referenceDate: string;
  last30Days: MetricWindowSummary;
  last90Days: MetricWindowSummary;
  historical: MetricWindowSummary;
  weightedScore: number;
  patterns: string[];
  risks: string[];
  opportunities: string[];
  topTopics: string[];
  topFormats: string[];
};

function emptySummary(): MetricWindowSummary {
  return {
    count: 0,
    impressions: 0,
    clicks: 0,
    leads: 0,
    qualifiedLeads: 0,
    meetings: 0,
    revenue: 0,
    cost: 0,
    averageCtr: 0,
    averageRetention: 0,
    roi: 0
  };
}

function summarize(records: MetricRecord[]): MetricWindowSummary {
  const summary = records.reduce((acc, item) => {
    acc.count += 1;
    acc.impressions += item.impressions;
    acc.clicks += item.clicks;
    acc.leads += item.leads;
    acc.qualifiedLeads += item.qualifiedLeads;
    acc.meetings += item.meetings;
    acc.revenue += item.attributedRevenue;
    acc.cost += item.cost;
    acc.averageCtr += item.ctr;
    acc.averageRetention += item.retention;
    return acc;
  }, emptySummary());
  if (summary.count > 0) {
    summary.averageCtr = Number((summary.averageCtr / summary.count).toFixed(4));
    summary.averageRetention = Number((summary.averageRetention / summary.count).toFixed(4));
  }
  summary.roi = summary.cost === 0 ? summary.revenue : Number(((summary.revenue - summary.cost) / summary.cost).toFixed(2));
  return summary;
}

function inDays(record: MetricRecord, reference: Date, days: number): boolean {
  const date = new Date(record.date);
  const diff = reference.getTime() - date.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function normalized(summary: MetricWindowSummary): number {
  const leadSignal = Math.min(5, summary.qualifiedLeads * 0.9 + summary.meetings * 1.2);
  const ctrSignal = Math.min(5, summary.averageCtr * 100);
  const authoritySignal = Math.min(5, summary.averageRetention * 6 + summary.meetings * 0.4);
  return Number(((leadSignal + ctrSignal + authoritySignal) / 3).toFixed(2));
}

function topValues(records: MetricRecord[], field: "topic" | "format", limit = 3): string[] {
  const scores = new Map<string, number>();
  for (const record of records) {
    const current = scores.get(record[field]) || 0;
    scores.set(record[field], current + record.qualifiedLeads * 3 + record.meetings * 5 + record.saves + record.shares);
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

export function analyzePerformance(records: MetricRecord[], config: RuntimeConfig, referenceDate = "2026-07-10"): PerformanceAnalysis {
  const reference = new Date(referenceDate);
  const last30Records = records.filter((record) => inDays(record, reference, 30));
  const last90Records = records.filter((record) => inDays(record, reference, 90));
  const last30Days = summarize(last30Records);
  const last90Days = summarize(last90Records);
  const historical = summarize(records);
  const weightedScore = Number(
    (
      normalized(last30Days) * config.temporalWeights.last30Days +
      normalized(last90Days) * config.temporalWeights.last90Days +
      normalized(historical) * config.temporalWeights.historical
    ).toFixed(2)
  );

  const patterns: string[] = [];
  const risks: string[] = [];
  const opportunities: string[] = [];

  if (last30Days.qualifiedLeads >= last90Days.qualifiedLeads / 3) {
    patterns.push("Qualified lead generation is sustained in the recent 30 day window.");
  }
  if (last30Days.averageCtr < 0.018) {
    risks.push("CTR is below the minimum useful signal for decision-maker content.");
  }
  if (last30Days.meetings > 0 && last30Days.averageRetention >= 0.55) {
    opportunities.push("Technical explainers with explicit meeting CTAs are converting.");
  }
  const topics = topValues(records, "topic");
  if (topics.includes("voice-agents") || topics.includes("process-automation")) {
    opportunities.push("Voice agents and process automation are the strongest authority themes.");
  }

  return {
    referenceDate,
    last30Days,
    last90Days,
    historical,
    weightedScore,
    patterns,
    risks,
    opportunities,
    topTopics: topics,
    topFormats: topValues(records, "format")
  };
}
