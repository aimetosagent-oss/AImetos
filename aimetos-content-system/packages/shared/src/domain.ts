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
  funnelStage: "TOFU" | "MOFU" | "BOFU";
  businessConsequence: string;
  proofOrExample: string;
};

export type DataSourceType = "real_manual" | "real_export" | "mock" | "estimated" | "pending";
export type SnapshotPeriod = "24h" | "48h" | "72h" | "7d" | "30d" | "latest";
export type ConfidenceLevel =
  | "insufficient_data"
  | "early_signal"
  | "developing_pattern"
  | "moderate_confidence"
  | "high_confidence";
export type AttributionConfidence = "confirmed" | "probable" | "unknown" | "unrelated";

export type AudienceBreakdown = {
  managersPercent?: number;
  directorsPercent?: number;
  decisionMakersPercent?: number;
  experiencedPercent?: number;
  inexperiencedPercent?: number;
  prioritySectors?: string[];
  companySizes?: Array<{ label: string; percent: number }>;
  locations?: Array<{ label: string; percent: number }>;
};

export type MetricSnapshot = {
  capturedAt: string;
  period: SnapshotPeriod;
  impressions?: number;
  views?: number;
  reach?: number;
  reactions?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  sends?: number;
  profileViews?: number;
  followers?: number;
  connectionRequestsReceived?: number;
  connectionRequestsAttributed?: number;
  attributionConfidence?: AttributionConfidence;
  decisionMakerConnections?: number;
  messagesReceived?: number;
  qualifiedLeads?: number;
  meetings?: number;
  proposals?: number;
  opportunities?: number;
  sourceType: DataSourceType;
  notes?: string;
};

export type RealContentRecord = {
  id: string;
  platform: "linkedin" | "instagram" | "facebook";
  title: string;
  topic: string;
  editorialAngle: string;
  format: string;
  publishedAt?: string;
  status: "published" | "metrics_pending" | "low_performance_early_result";
  sourceType: DataSourceType;
  targetCustomer: string;
  funnelStage: "TOFU" | "MOFU" | "BOFU";
  snapshots: MetricSnapshot[];
  audience?: AudienceBreakdown;
  qualitativeSignals?: string[];
};

export type BusinessContentScore = {
  total: number;
  confidence: ConfidenceLevel;
  comparablePosts: number;
  breakdown: {
    reach: number;
    engagement: number;
    profileInterest: number;
    decisionMaker: number;
    audienceFit: number;
    conversation: number;
    commercialSignal: number;
    authority: number;
    differentiation: number;
    reusability: number;
    marketSignal: number;
    sampleConfidence: number;
  };
  explanation: string;
};

export type MarketSignal = {
  id: string;
  signalType:
    | "customer_objection"
    | "sales_conversation"
    | "market_saturation"
    | "competitor_message"
    | "recurring_pain"
    | "audience_comment"
    | "commercial_feedback";
  source: string;
  date: string;
  description: string;
  affectedTopic: string;
  strength: 1 | 2 | 3 | 4 | 5;
  confidence: ConfidenceLevel;
  editorialImplication: string;
};

export type EditorialMemoryItem = {
  topic: string;
  lastPublishedAt?: string;
  timesPublished: number;
  relatedContentIds: string[];
  saturationScore: number;
  reusePossible: boolean;
  nextAllowedDate?: string;
  narrativeRole:
    | "open_problem"
    | "reframe_problem"
    | "show_solution"
    | "demonstrate_technical_depth"
    | "case_study"
    | "answer_objection"
    | "conversion";
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
