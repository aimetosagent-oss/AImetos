export type AppMode = "mock" | "development" | "staging" | "production";

export type MockScenario =
  | "normal"
  | "high_performance"
  | "low_performance"
  | "missing_data"
  | "api_failure"
  | "rate_limit"
  | "expired_credentials"
  | "publishing_failure"
  | "partial_metrics"
  | "no_qualified_ideas";

export const contentStatuses = [
  "DRAFT_IDEA",
  "ANALYZED",
  "PRIORITIZED",
  "SELECTED",
  "CONTENT_DRAFTED",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "FORMATS_GENERATED",
  "SCHEDULED",
  "PUBLISHED",
  "METRICS_PENDING",
  "METRICS_COLLECTED",
  "ARCHIVED",
  "REJECTED"
] as const;

export type ContentStatus = (typeof contentStatuses)[number];

export const allowedTransitions: Record<ContentStatus, ContentStatus[]> = {
  DRAFT_IDEA: ["ANALYZED", "REJECTED"],
  ANALYZED: ["PRIORITIZED", "REJECTED"],
  PRIORITIZED: ["SELECTED", "REJECTED"],
  SELECTED: ["CONTENT_DRAFTED", "REJECTED"],
  CONTENT_DRAFTED: ["IN_REVIEW"],
  IN_REVIEW: ["CHANGES_REQUESTED", "APPROVED", "REJECTED"],
  CHANGES_REQUESTED: ["CONTENT_DRAFTED", "REJECTED"],
  APPROVED: ["FORMATS_GENERATED"],
  FORMATS_GENERATED: ["SCHEDULED"],
  SCHEDULED: ["PUBLISHED", "REJECTED"],
  PUBLISHED: ["METRICS_PENDING"],
  METRICS_PENDING: ["METRICS_COLLECTED"],
  METRICS_COLLECTED: ["ARCHIVED"],
  ARCHIVED: [],
  REJECTED: []
};

export type Language = "ca" | "es" | "en";

export type ContentCategory =
  | "Cas real"
  | "Opinio tecnica"
  | "Comparativa"
  | "Error habitual"
  | "Tutorial"
  | "Estrategia"
  | "Tendencia amb impacte empresarial";

export type Platform =
  | "blog"
  | "linkedin"
  | "instagram"
  | "facebook"
  | "youtube"
  | "newsletter"
  | "google_drive"
  | "gmail"
  | "google_calendar";

export type ContentIdea = {
  id: string;
  title: string;
  objective: string;
  audience: string;
  pain: string;
  value: string;
  mainMessage: string;
  cta: string;
  priority: number;
  justification: string;
  relatedService: string;
  primaryChannel: Platform;
  estimatedEffort: number;
  commercialImpact: number;
  differentiation: number;
  authority: number;
  reusability: number;
  globalScore: number;
  category: ContentCategory;
  language: Language;
  status: ContentStatus;
};

export type MetricRecord = {
  id: string;
  date: string;
  platform: Platform;
  format: string;
  topic: string;
  keyword: string;
  cta: string;
  reach: number;
  impressions: number;
  clicks: number;
  ctr: number;
  views: number;
  readTimeSeconds: number;
  watchTimeSeconds: number;
  retention: number;
  comments: number;
  shares: number;
  saves: number;
  reactions: number;
  profileVisits: number;
  websiteVisits: number;
  forms: number;
  leads: number;
  qualifiedLeads: number;
  meetings: number;
  conversionRate: number;
  cost: number;
  attributedRevenue: number;
  roi: number;
  publicationStatus: "draft" | "scheduled" | "published" | "failed";
};

export type AuditEvent = {
  id: string;
  user: string;
  date: string;
  change: string;
  previousStatus: ContentStatus;
  nextStatus: ContentStatus;
  comment: string;
  version: number;
  origin: string;
};

export type ConnectorKind = "analytics" | "ai" | "publishing" | "infrastructure";

export type ConnectorResult<TOutput> = {
  ok: boolean;
  code: "OK" | "MOCK_OK" | "CREDENTIALS_NOT_CONFIGURED" | "CONFIG_INVALID" | "SIMULATED_FAILURE" | "RATE_LIMITED";
  message: string;
  data?: TOutput;
  retryAfterMs?: number;
};
