export type Health = "ok" | "warning" | "error" | "unknown";

export interface SourceState {
  id: string;
  label: string;
  health: Health;
  detail: string;
  updatedAt?: string;
}

export interface AgentRow {
  id: string;
  name: string;
  cadence: string;
  health: Health;
  active: boolean;
  lastRun?: string;
  nextExpected?: string;
  processed?: number;
  error?: string;
  url?: string;
}

export interface LeadTrendPoint {
  label: string;
  value: number;
}

export interface LeadSummary {
  total: number;
  newLast7Days: number;
  qualified: number;
  contacted: number;
  replies: number;
  enrichmentErrors: number;
  bySource: Array<{ label: string; value: number }>;
  trend: LeadTrendPoint[];
}

export interface ProjectRow {
  id: string;
  name: string;
  status: string;
  progress: number;
  nextAction: string;
  urgency: string;
  blocked: boolean;
  hours31Days?: number;
  adjustedValue?: number;
  completedAt?: string;
}

export interface ProjectSummary {
  active: number;
  completedPreviousWeek: number | null;
  completedMetricNote?: string;
  blocked: number;
  hours31Days: number | null;
  projects: ProjectRow[];
  hoursByProject: Array<{ label: string; value: number }>;
}

export interface FinanceSummary {
  cashReal: number | null;
  cashForecast: number | null;
  quarterResult: number | null;
  taxEstimate: number | null;
  pendingIncome: number | null;
  pendingExpenses: number | null;
  quarterLabel: string;
  nativeSheetReady: boolean;
}

export interface SocialSummary {
  winningChannel: string;
  winningFormat: string;
  decision: string;
  readyToReview: number;
  draftsNeeded: number;
  qualifiedLeads: number;
  meetings: number;
  topContent: Array<{
    rank: number;
    title: string;
    platform: string;
    format: string;
    qualifiedLeads: number;
    meetings: number;
    score: number;
  }>;
}

export interface Incident {
  id: string;
  severity: "high" | "medium" | "low";
  category: "agent" | "lead" | "project" | "finance" | "social";
  title: string;
  detail: string;
  occurredAt: string;
  href?: string;
}

export interface ControlCenterData {
  generatedAt: string;
  mode: "live" | "demo" | "partial";
  agents: AgentRow[];
  leads: LeadSummary;
  projects: ProjectSummary;
  finance: FinanceSummary;
  social: SocialSummary;
  incidents: Incident[];
  sources: SourceState[];
}
