import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));
const projectRoot = join(workspaceRoot, "aimetos-content-system");

function write(relPath: string, content: string) {
  const target = join(projectRoot, relPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content.replace(/\n/g, "\r\n"), "utf8");
}

function writeJson(relPath: string, value: unknown) {
  write(relPath, JSON.stringify(value, null, 2) + "\n");
}

function ensureProjectRoot() {
  if (!existsSync(projectRoot)) {
    mkdirSync(projectRoot, { recursive: true });
  }
}

const packageJson = {
  name: "aimetos-content-system",
  version: "0.1.0",
  private: true,
  description: "Mock-first automated content and digital strategy system for AImetos.",
  type: "module",
  packageManager: "pnpm@11.7.0",
  workspaces: ["apps/*", "packages/*"],
  engines: {
    node: ">=24.0.0",
    pnpm: ">=11.0.0"
  },
  scripts: {
    dev: "node apps/api/src/server.ts",
    build: "node scripts/build.ts",
    lint: "node scripts/lint.ts",
    format: "node scripts/format-check.ts",
    typecheck: "node scripts/typecheck.ts",
    test: "node --test tests/unit/*.test.ts",
    "test:integration": "node --test tests/integration/*.test.ts",
    "test:e2e": "node --test tests/e2e/*.test.ts",
    "test:all": "node scripts/run-tests.ts",
    "db:migrate": "node scripts/db-migrate.ts",
    "db:seed": "node scripts/db-seed.ts",
    "mock:reset": "node scripts/mock-reset.ts",
    "mock:scenario": "node scripts/mock-scenario.ts",
    "docker:up": "docker compose -f docker-compose.yml -f docker-compose.mock.yml up --build",
    "docker:down": "docker compose down",
    "docker:validate": "node scripts/validate-docker.ts",
    validate: "node scripts/validate.ts"
  }
};

const rootDocs: Record<string, string> = {
  "README.md": `# AImetos Content System

Mock-first automated content and digital strategy system for AImetos.

This repository is prepared to run without real credentials. In \`APP_MODE=mock\`, every connector uses deterministic fixtures, controlled scenarios and structured logs. Real connectors are present, typed and documented, but return controlled credential errors until their environment variables are enabled.

## Quick start

\`\`\`bash
pnpm run validate
pnpm run dev
\`\`\`

The local API serves the dashboard and the mock endpoints at [http://localhost:4317](http://localhost:4317).

## Main flow

\`\`\`text
Mock data -> analysis -> 5 ideas -> prioritization -> selection -> approval
-> article -> LinkedIn -> adaptations -> scheduling -> mock publishing
-> metrics -> report
\`\`\`

## Structure

- \`apps/api\`: local HTTP API, health checks and dashboard static serving.
- \`apps/dashboard\`: operational dashboard assets and Next-compatible screen skeleton.
- \`apps/worker\`: scheduled worker entrypoint for mock runs.
- \`packages/core\`: workflow orchestration, state machine and audit events.
- \`packages/analytics\`: 30/90/historical weighted performance analysis.
- \`packages/strategy\`: idea generation, scoring and selection.
- \`packages/content\`: article, LinkedIn and multichannel adaptation generation.
- \`packages/publishing\`: schedule and mock publication logic.
- \`packages/connectors\`: mock and real connector registry.
- \`packages/database\`: Prisma schema, SQL migration and seed entrypoint.
- \`automation/n8n\`: importable workflows and reusable subworkflows.
- \`data/fixtures\`: realistic mock metrics, leads, campaigns and errors.
- \`docs\`: operating documentation and credential rollout.

## No secrets

Do not commit credentials. Use \`.env.example\` as the contract and activate integrations progressively as documented in \`docs/credentials-rollout.md\`.
`,
  ".gitignore": `# Secrets and local configuration
.env
.env.*
!.env.example
*.pem
*.key
*.p12
*.pfx
secrets/
credentials/
**/secrets/
**/credentials/

# Node
node_modules/
.pnpm-store/
npm-debug.log*
pnpm-debug.log*

# Build and test output
dist/
build/
coverage/
playwright-report/
test-results/

# Runtime exports
data/exports/*
!data/exports/.gitkeep

# n8n and local state
.n8n/
n8n-data/
*.sqlite
*.sqlite3
*.log
tmp/
temp/

# OS and editors
.DS_Store
Thumbs.db
.idea/
.vscode/
`,
  ".editorconfig": `root = true

[*]
charset = utf-8
end_of_line = crlf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
`,
  ".env.example": `APP_NAME=aimetos-content-system
APP_MODE=mock
MOCK_SCENARIO=normal
PORT=4317
LOG_LEVEL=info
DEFAULT_LANGUAGE=ca

TEMPORAL_WEIGHT_30_DAYS=0.6
TEMPORAL_WEIGHT_90_DAYS=0.3
TEMPORAL_WEIGHT_HISTORICAL=0.1
MIN_AVERAGE_SCORE=3.8
MIN_COMMERCIAL_IMPACT=4

DATABASE_URL=postgresql://aimetos:aimetos@localhost:5432/aimetos_content
POSTGRES_USER=aimetos
POSTGRES_PASSWORD=aimetos
POSTGRES_DB=aimetos_content

GA4_ENABLED=false
SEARCH_CONSOLE_ENABLED=false
LINKEDIN_ENABLED=false
INSTAGRAM_ENABLED=false
FACEBOOK_ENABLED=false
YOUTUBE_ENABLED=false
OPENAI_ENABLED=false
ANTHROPIC_ENABLED=false
GHL_ENABLED=false
GOOGLE_WORKSPACE_ENABLED=false
PUBLISHING_ENABLED=false
CRM_ENABLED=false
GITHUB_ENABLED=false
N8N_ENABLED=false
EASYPANEL_ENABLED=false
HOSTINGER_ENABLED=false

GA4_PROPERTY_ID=
SEARCH_CONSOLE_SITE_URL=
LINKEDIN_ORGANIZATION_ID=
META_ACCOUNT_ID=
YOUTUBE_CHANNEL_ID=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GHL_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_TOKEN=
N8N_BASE_URL=
N8N_API_KEY=
`,
  "CONTRIBUTING.md": `# Contributing

Use feature branches from \`develop\`, conventional commits and pull requests. Keep changes small, tested and documented. No secrets or customer data are allowed in commits.

Before a PR:

\`\`\`bash
pnpm run validate
\`\`\`
`,
  "SECURITY.md": `# Security

Report security issues privately to the repository owner. This project avoids real credentials in mock mode, redacts sensitive keys in logs and requires explicit connector activation.

Security controls included:

- environment-based configuration,
- no committed secrets,
- input validation,
- RBAC-ready schema,
- audit logs,
- structured logging with redaction,
- secret scanning in CI,
- mock-first connector activation.
`,
  "CHANGELOG.md": `# Changelog

## 0.1.0

- Initial mock-first AImetos content system.
- Added modular packages, dashboard, API, worker, fixtures, n8n workflows, docs, CI and Docker assets.
`,
  "LICENSE": `MIT License

Copyright (c) 2026 AImetos

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files to deal in the Software
without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the
Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED AS IS, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
`,
  "CODE_OF_CONDUCT.md": `# Code of Conduct

Work with respect, clarity and accountability. Keep review comments specific, constructive and tied to user value, reliability or safety.
`,
  "pnpm-workspace.yaml": `packages:
  - apps/*
  - packages/*
`,
  "tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["apps/**/*.ts", "apps/**/*.tsx", "packages/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts"]
}
`,
  "eslint.config.js": `export default [
  {
    ignores: ["dist/**", "node_modules/**", "data/exports/**"],
    rules: {
      "no-unused-vars": "off"
    }
  }
];
`,
  ".prettierrc.json": `{
  "printWidth": 100,
  "singleQuote": false,
  "semi": true,
  "trailingComma": "none"
}
`
};

const sharedDomain = `export type AppMode = "mock" | "development" | "staging" | "production";

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
`;

const configEnv = `import type { AppMode, MockScenario, Language } from "../../shared/src/domain.ts";

export type RuntimeConfig = {
  appName: string;
  appMode: AppMode;
  mockScenario: MockScenario;
  port: number;
  logLevel: "debug" | "info" | "warn" | "error";
  defaultLanguage: Language;
  temporalWeights: {
    last30Days: number;
    last90Days: number;
    historical: number;
  };
  thresholds: {
    minAverageScore: number;
    minCommercialImpact: number;
  };
  connectors: Record<string, boolean>;
};

const appModes = ["mock", "development", "staging", "production"];
const scenarios = [
  "normal",
  "high_performance",
  "low_performance",
  "missing_data",
  "api_failure",
  "rate_limit",
  "expired_credentials",
  "publishing_failure",
  "partial_metrics",
  "no_qualified_ideas"
];
const languages = ["ca", "es", "en"];

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error("Invalid numeric environment variable " + name);
  }
  return value;
}

function booleanFromEnv(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw.toLowerCase() === "true";
}

function pick<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const raw = process.env[name] || fallback;
  if (!allowed.includes(raw as T)) {
    throw new Error("Invalid " + name + ": " + raw);
  }
  return raw as T;
}

export function loadConfig(): RuntimeConfig {
  const config: RuntimeConfig = {
    appName: process.env.APP_NAME || "aimetos-content-system",
    appMode: pick("APP_MODE", appModes, "mock"),
    mockScenario: pick("MOCK_SCENARIO", scenarios, "normal"),
    port: numberFromEnv("PORT", 4317),
    logLevel: pick("LOG_LEVEL", ["debug", "info", "warn", "error"], "info"),
    defaultLanguage: pick("DEFAULT_LANGUAGE", languages, "ca"),
    temporalWeights: {
      last30Days: numberFromEnv("TEMPORAL_WEIGHT_30_DAYS", 0.6),
      last90Days: numberFromEnv("TEMPORAL_WEIGHT_90_DAYS", 0.3),
      historical: numberFromEnv("TEMPORAL_WEIGHT_HISTORICAL", 0.1)
    },
    thresholds: {
      minAverageScore: numberFromEnv("MIN_AVERAGE_SCORE", 3.8),
      minCommercialImpact: numberFromEnv("MIN_COMMERCIAL_IMPACT", 4)
    },
    connectors: {
      ga4: booleanFromEnv("GA4_ENABLED"),
      searchConsole: booleanFromEnv("SEARCH_CONSOLE_ENABLED"),
      linkedIn: booleanFromEnv("LINKEDIN_ENABLED"),
      instagram: booleanFromEnv("INSTAGRAM_ENABLED"),
      facebook: booleanFromEnv("FACEBOOK_ENABLED"),
      youtube: booleanFromEnv("YOUTUBE_ENABLED"),
      openai: booleanFromEnv("OPENAI_ENABLED"),
      anthropic: booleanFromEnv("ANTHROPIC_ENABLED"),
      ghl: booleanFromEnv("GHL_ENABLED"),
      googleWorkspace: booleanFromEnv("GOOGLE_WORKSPACE_ENABLED"),
      publishing: booleanFromEnv("PUBLISHING_ENABLED"),
      crm: booleanFromEnv("CRM_ENABLED"),
      github: booleanFromEnv("GITHUB_ENABLED"),
      n8n: booleanFromEnv("N8N_ENABLED"),
      easypanel: booleanFromEnv("EASYPANEL_ENABLED"),
      hostinger: booleanFromEnv("HOSTINGER_ENABLED")
    }
  };

  const total =
    config.temporalWeights.last30Days +
    config.temporalWeights.last90Days +
    config.temporalWeights.historical;
  if (Math.abs(total - 1) > 0.001) {
    throw new Error("Temporal weights must add up to 1");
  }

  return config;
}
`;

const logger = `import { randomUUID } from "node:crypto";

const secretLike = /(api[_-]?key|token|secret|password|credential)/i;

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogRecord = {
  runId: string;
  level: LogLevel;
  time: string;
  workflow?: string;
  connector?: string;
  status?: string;
  message: string;
  durationMs?: number;
  retries?: number;
  inputSummary?: unknown;
  outputSummary?: unknown;
  error?: string;
};

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = secretLike.test(key) ? "[redacted]" : redact(inner);
    }
    return out;
  }
  return value;
}

export function createRunId(prefix = "run"): string {
  return prefix + "_" + randomUUID();
}

export function log(record: Omit<LogRecord, "time">): LogRecord {
  const safe: LogRecord = {
    ...record,
    time: new Date().toISOString(),
    inputSummary: redact(record.inputSummary),
    outputSummary: redact(record.outputSummary)
  };
  console.log(JSON.stringify(safe));
  return safe;
}
`;

const validationSchemas = `import type { ContentIdea, ContentStatus, MetricRecord } from "../../shared/src/domain.ts";
import { contentStatuses } from "../../shared/src/domain.ts";

export type ValidationIssue = {
  path: string;
  message: string;
};

export type ValidationResult = {
  ok: boolean;
  issues: ValidationIssue[];
};

function issue(path: string, message: string): ValidationIssue {
  return { path, message };
}

function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

export function validateContentStatus(status: string): status is ContentStatus {
  return contentStatuses.includes(status as ContentStatus);
}

export function validateIdea(idea: ContentIdea): ValidationResult {
  const issues: ValidationIssue[] = [];
  const textFields = [
    "title",
    "objective",
    "audience",
    "pain",
    "value",
    "mainMessage",
    "cta",
    "justification",
    "relatedService"
  ] as const;
  for (const field of textFields) {
    if (!idea[field] || idea[field].trim().length < 3) {
      issues.push(issue(field, "Required text field is too short"));
    }
  }
  for (const field of [
    "priority",
    "estimatedEffort",
    "commercialImpact",
    "differentiation",
    "authority",
    "reusability",
    "globalScore"
  ] as const) {
    if (!inRange(idea[field], 1, 5)) {
      issues.push(issue(field, "Score must be between 1 and 5"));
    }
  }
  if (!validateContentStatus(idea.status)) {
    issues.push(issue("status", "Invalid content status"));
  }
  return { ok: issues.length === 0, issues };
}

export function validateMetric(metric: MetricRecord): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!metric.id) issues.push(issue("id", "Metric id is required"));
  if (!Date.parse(metric.date)) issues.push(issue("date", "Metric date must be ISO-compatible"));
  for (const field of [
    "reach",
    "impressions",
    "clicks",
    "views",
    "leads",
    "qualifiedLeads",
    "meetings",
    "cost",
    "attributedRevenue"
  ] as const) {
    if (!Number.isFinite(metric[field]) || metric[field] < 0) {
      issues.push(issue(field, "Metric must be a non-negative number"));
    }
  }
  if (!inRange(metric.ctr, 0, 1)) issues.push(issue("ctr", "CTR must be between 0 and 1"));
  if (!inRange(metric.retention, 0, 1)) issues.push(issue("retention", "Retention must be between 0 and 1"));
  return { ok: issues.length === 0, issues };
}
`;

const stateMachine = `import { randomUUID } from "node:crypto";
import { allowedTransitions, type AuditEvent, type ContentStatus } from "../../shared/src/domain.ts";

export function canTransition(previousStatus: ContentStatus, nextStatus: ContentStatus): boolean {
  return allowedTransitions[previousStatus].includes(nextStatus);
}

export function transitionContentStatus(input: {
  previousStatus: ContentStatus;
  nextStatus: ContentStatus;
  user: string;
  comment: string;
  version: number;
  origin: string;
  now?: string;
}): AuditEvent {
  if (!canTransition(input.previousStatus, input.nextStatus)) {
    throw new Error("Invalid content status transition from " + input.previousStatus + " to " + input.nextStatus);
  }
  return {
    id: "audit_" + randomUUID(),
    user: input.user,
    date: input.now || new Date().toISOString(),
    change: "status_change",
    previousStatus: input.previousStatus,
    nextStatus: input.nextStatus,
    comment: input.comment,
    version: input.version,
    origin: input.origin
  };
}

export function transitionPath(statuses: ContentStatus[], origin = "mock-flow"): AuditEvent[] {
  const events: AuditEvent[] = [];
  for (let index = 1; index < statuses.length; index += 1) {
    events.push(
      transitionContentStatus({
        previousStatus: statuses[index - 1],
        nextStatus: statuses[index],
        user: "system",
        comment: "Automated mock transition",
        version: index,
        origin
      })
    );
  }
  return events;
}
`;

const analytics = `import type { MetricRecord } from "../../shared/src/domain.ts";
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
`;

const strategy = `import type { ContentIdea, MockScenario } from "../../shared/src/domain.ts";
import type { RuntimeConfig } from "../../config/src/env.ts";
import type { PerformanceAnalysis } from "../../analytics/src/performance.ts";

function averageScore(idea: Pick<ContentIdea, "commercialImpact" | "differentiation" | "estimatedEffort" | "reusability" | "authority">): number {
  const ease = 6 - idea.estimatedEffort;
  return Number(((idea.commercialImpact + idea.differentiation + ease + idea.reusability + idea.authority) / 5).toFixed(2));
}

function score(value: number): number {
  return Math.min(5, Math.max(1, Number(value.toFixed(2))));
}

function withScore(idea: Omit<ContentIdea, "globalScore" | "status">): ContentIdea {
  return { ...idea, status: "DRAFT_IDEA", globalScore: averageScore(idea) };
}

export function generateFiveIdeas(analysis: PerformanceAnalysis, scenario: MockScenario): ContentIdea[] {
  const lowQuality = scenario === "no_qualified_ideas";
  const modifier = lowQuality ? -2 : analysis.weightedScore >= 4 ? 0.4 : 0;
  const ideas = [
    withScore({
      id: "idea_voice_roi",
      title: "Com saber si un agent de veu te ROI abans de construir-lo",
      objective: "Filtrar oportunitats reals per a agents de veu B2B.",
      audience: "Direccio comercial i operacions de PIMEs amb trucades repetitives.",
      pain: "Volen automatitzar trucades pero no saben si el volum justifica la inversio.",
      value: "Un model simple per decidir amb dades abans de desenvolupar.",
      mainMessage: "L'agent de veu nomes te sentit quan resol volum, variabilitat i seguiment mesurable.",
      cta: "Demanar una auditoria de processos automatitzables",
      priority: 1,
      justification: "Connecta amb leads qualificats i evita promeses buides.",
      relatedService: "Agents de veu",
      primaryChannel: "linkedin",
      estimatedEffort: 2,
      commercialImpact: score(5 + modifier),
      differentiation: score(5 + modifier),
      authority: score(5 + modifier),
      reusability: score(4 + modifier),
      category: "Estrategia",
      language: "ca"
    }),
    withScore({
      id: "idea_n8n_failures",
      title: "Els 7 errors que fan fragils les automatitzacions amb n8n",
      objective: "Educar sobre robustesa operativa.",
      audience: "Responsables tecnics i operatius amb workflows manuals o semi-automatitzats.",
      pain: "Els workflows funcionen en demo pero fallen quan hi ha dades incompletes.",
      value: "Criteris practics de retries, logs, validacio i ownership.",
      mainMessage: "Automatitzar no es unir nodes: es dissenyar un sistema que aguanti errors.",
      cta: "Revisar un workflow critic amb AImetos",
      priority: 2,
      justification: "Tema diferencial i molt reutilitzable per blog, LinkedIn i newsletter.",
      relatedService: "Automatitzacions amb n8n",
      primaryChannel: "blog",
      estimatedEffort: 2,
      commercialImpact: score(4 + modifier),
      differentiation: score(5 + modifier),
      authority: score(5 + modifier),
      reusability: score(5 + modifier),
      category: "Error habitual",
      language: "ca"
    }),
    withScore({
      id: "idea_whatsapp_agent",
      title: "Quan un agent de WhatsApp millora vendes i quan nomes afegeix soroll",
      objective: "Separar casos d'us reals de moda.",
      audience: "Empreses de serveis amb consultes repetitives i seguiment comercial.",
      pain: "Tenen converses disperses i baixa traçabilitat del lead.",
      value: "Criteris per decidir si cal agent, CRM o redisseny de proces.",
      mainMessage: "El canal no arregla un proces comercial desordenat; l'agent ha de tancar el cercle.",
      cta: "Mapar el proces comercial actual",
      priority: 3,
      justification: "Apropa venda consultiva sense clickbait.",
      relatedService: "Agents de WhatsApp",
      primaryChannel: "linkedin",
      estimatedEffort: 3,
      commercialImpact: score(4 + modifier),
      differentiation: score(4 + modifier),
      authority: score(4 + modifier),
      reusability: score(4 + modifier),
      category: "Comparativa",
      language: "ca"
    }),
    withScore({
      id: "idea_dashboard_decisions",
      title: "Un dashboard no serveix si no canvia cap decisio",
      objective: "Reposicionar dashboards com sistemes de decisio.",
      audience: "Gerencia i operacions amb informes manuals.",
      pain: "Mesuren molt pero actuen tard.",
      value: "Checklist per passar d'informe a sistema d'alertes i decisions.",
      mainMessage: "La metrica important es la que activa una decisio clara.",
      cta: "Identificar les 5 decisions que hauria d'activar el dashboard",
      priority: 4,
      justification: "Reforça autoritat en dashboards i automatitzacio interna.",
      relatedService: "Dashboards",
      primaryChannel: "blog",
      estimatedEffort: 2,
      commercialImpact: score(4 + modifier),
      differentiation: score(4 + modifier),
      authority: score(4 + modifier),
      reusability: score(5 + modifier),
      category: "Opinio tecnica",
      language: "ca"
    }),
    withScore({
      id: "idea_crm_ai",
      title: "CRM amb IA: que automatitzar abans d'afegir un agent",
      objective: "Crear confiança amb una seqüencia d'implantacio prudent.",
      audience: "Equips comercials B2B amb CRM infrautilitzat.",
      pain: "Volen IA pero encara perden seguiments basics.",
      value: "Ordre d'implantacio: dades, camps, alertes, workflows, agent.",
      mainMessage: "La IA comercial funciona quan el CRM ja captura el proces real.",
      cta: "Fer una revisio de CRM i seguiment",
      priority: 5,
      justification: "Genera leads qualificats amb una promesa realista.",
      relatedService: "CRM i IA aplicada",
      primaryChannel: "newsletter",
      estimatedEffort: 3,
      commercialImpact: score(4 + modifier),
      differentiation: score(3.5 + modifier),
      authority: score(4 + modifier),
      reusability: score(4 + modifier),
      category: "Estrategia",
      language: "ca"
    })
  ];
  return ideas.map((idea) => ({ ...idea, globalScore: averageScore(idea) }));
}

export function selectBestIdeas(ideas: ContentIdea[], config: RuntimeConfig): ContentIdea[] {
  return ideas
    .filter(
      (idea) =>
        idea.globalScore >= config.thresholds.minAverageScore &&
        idea.commercialImpact >= config.thresholds.minCommercialImpact
    )
    .sort((a, b) => b.globalScore - a.globalScore || b.commercialImpact - a.commercialImpact)
    .slice(0, 3)
    .map((idea, index) => ({
      ...idea,
      priority: index + 1,
      status: "SELECTED"
    }));
}
`;

const contentGenerator = `import type { ContentIdea } from "../../shared/src/domain.ts";

export type GeneratedContent = {
  ideaId: string;
  article: {
    title: string;
    slug: string;
    summary: string;
    body: string;
    seoTitle: string;
    seoDescription: string;
    cta: string;
  };
  linkedin: {
    text: string;
    cta: string;
  };
  adaptations: Array<{
    channel: string;
    format: string;
    content: string;
    metadata: Record<string, string | string[]>;
  }>;
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function generateContentForIdea(idea: ContentIdea): GeneratedContent {
  const slug = slugify(idea.title);
  const articleBody = [
    "# " + idea.title,
    "",
    "## Context",
    idea.audience + " sovint arriba a aquest punt: " + idea.pain,
    "",
    "## Criteri practic",
    idea.mainMessage,
    "",
    "## Com ho enfoca AImetos",
    "1. Mesura el volum i la repeticio del proces.",
    "2. Valida que hi hagi dades suficients i un propietari clar.",
    "3. Dissenya una primera versio petita, observable i reversible.",
    "4. Connecta el resultat amb CRM, reunions o seguiment comercial.",
    "",
    "## Valor",
    idea.value,
    "",
    "## Seguent pas",
    idea.cta + "."
  ].join("\\n");

  return {
    ideaId: idea.id,
    article: {
      title: idea.title,
      slug,
      summary: idea.value,
      body: articleBody,
      seoTitle: idea.title + " | AImetos",
      seoDescription: idea.mainMessage,
      cta: idea.cta
    },
    linkedin: {
      text: [
        idea.title,
        "",
        "La pregunta no es si la IA pot fer-ho.",
        "La pregunta es si el proces te prou volum, criteris i traçabilitat per automatitzar-lo amb garanties.",
        "",
        idea.mainMessage,
        "",
        "A AImetos ho validem abans de construir: problema, dades, integracions, riscos i impacte comercial.",
        "",
        "CTA: " + idea.cta
      ].join("\\n"),
      cta: idea.cta
    },
    adaptations: [
      {
        channel: "blog",
        format: "long_form",
        content: articleBody,
        metadata: { slug, language: idea.language, category: idea.category }
      },
      {
        channel: "newsletter",
        format: "email",
        content: "Assumpte: " + idea.title + "\\n\\n" + idea.value + "\\n\\n" + idea.cta,
        metadata: { segment: "b2b-operations", cta: idea.cta }
      },
      {
        channel: "instagram",
        format: "carousel",
        content: "5 diapositives: problema, criteri, exemple, risc, CTA.",
        metadata: { hashtags: ["#automatitzacio", "#iaempresa", "#aimetos"] }
      },
      {
        channel: "facebook",
        format: "post",
        content: idea.mainMessage + "\\n\\n" + idea.cta,
        metadata: { tone: "professional" }
      },
      {
        channel: "youtube",
        format: "script",
        content: "Guio de 4 minuts amb introduccio, criteris, exemple i CTA.",
        metadata: { title: idea.title, description: idea.value }
      },
      {
        channel: "reels",
        format: "short_script",
        content: "Hook: " + idea.pain + ". Resolucio: " + idea.mainMessage,
        metadata: { duration: "45s" }
      },
      {
        channel: "seo",
        format: "metadata",
        content: idea.mainMessage,
        metadata: {
          title: idea.title,
          description: idea.value,
          keywords: [idea.relatedService, "automatitzacio B2B", "IA empresarial"]
        }
      },
      {
        channel: "visual",
        format: "thumbnail_prompt",
        content: "Professional operations dashboard showing " + idea.relatedService + " impact, clean B2B style.",
        metadata: { usage: "thumbnail-or-cover" }
      }
    ]
  };
}
`;

const publishing = `import type { ContentIdea, MockScenario } from "../../shared/src/domain.ts";
import type { GeneratedContent } from "../../content/src/generator.ts";

export type PublicationPlan = {
  ideaId: string;
  scheduledAt: string;
  channels: string[];
  status: "scheduled" | "published" | "failed";
  publicationIds: string[];
  error?: string;
};

export function scheduleContent(idea: ContentIdea, generated: GeneratedContent, start = "2026-07-14T09:00:00.000Z"): PublicationPlan {
  const channels = ["blog", "linkedin", ...generated.adaptations.map((item) => item.channel)].filter(
    (value, index, list) => list.indexOf(value) === index
  );
  return {
    ideaId: idea.id,
    scheduledAt: start,
    channels,
    status: "scheduled",
    publicationIds: []
  };
}

export function publishMock(plan: PublicationPlan, scenario: MockScenario): PublicationPlan {
  if (scenario === "publishing_failure") {
    return {
      ...plan,
      status: "failed",
      error: "SIMULATED_PUBLISHING_FAILURE"
    };
  }
  return {
    ...plan,
    status: "published",
    publicationIds: plan.channels.map((channel) => "mock_" + channel + "_" + plan.ideaId)
  };
}
`;

const connectorInterface = `import type { ConnectorKind, ConnectorResult } from "../../shared/src/domain.ts";

export type ValidationResult = {
  ok: boolean;
  issues: string[];
};

export type HealthStatus = {
  ok: boolean;
  status: "healthy" | "disabled" | "degraded" | "missing_credentials";
  message: string;
};

export interface Connector<TConfig, TInput, TOutput> {
  name: string;
  kind: ConnectorKind;
  enabled: boolean;
  validateConfig(config: TConfig): Promise<ValidationResult>;
  execute(input: TInput): Promise<ConnectorResult<TOutput>>;
  healthCheck(): Promise<HealthStatus>;
}
`;

const connectorRegistry = `import type { MockScenario } from "../../shared/src/domain.ts";
import type { RuntimeConfig } from "../../config/src/env.ts";
import type { Connector, HealthStatus, ValidationResult } from "./interface.ts";

export type ConnectorSpec = {
  name: string;
  kind: "analytics" | "ai" | "publishing" | "infrastructure";
  envFlag: string;
  requiredEnv: string[];
};

export type GenericConnector = Connector<Record<string, string | undefined>, Record<string, unknown>, Record<string, unknown>>;

export const connectorSpecs: ConnectorSpec[] = [
  { name: "ga4", kind: "analytics", envFlag: "ga4", requiredEnv: ["GA4_PROPERTY_ID"] },
  { name: "search_console", kind: "analytics", envFlag: "searchConsole", requiredEnv: ["SEARCH_CONSOLE_SITE_URL"] },
  { name: "linkedin_analytics", kind: "analytics", envFlag: "linkedIn", requiredEnv: ["LINKEDIN_ORGANIZATION_ID"] },
  { name: "facebook_insights", kind: "analytics", envFlag: "facebook", requiredEnv: ["META_ACCOUNT_ID"] },
  { name: "instagram_insights", kind: "analytics", envFlag: "instagram", requiredEnv: ["META_ACCOUNT_ID"] },
  { name: "youtube_analytics", kind: "analytics", envFlag: "youtube", requiredEnv: ["YOUTUBE_CHANNEL_ID"] },
  { name: "internal_dashboard", kind: "analytics", envFlag: "publishing", requiredEnv: [] },
  { name: "crm", kind: "analytics", envFlag: "crm", requiredEnv: [] },
  { name: "gohighlevel", kind: "analytics", envFlag: "ghl", requiredEnv: ["GHL_API_KEY"] },
  { name: "openai", kind: "ai", envFlag: "openai", requiredEnv: ["OPENAI_API_KEY"] },
  { name: "anthropic", kind: "ai", envFlag: "anthropic", requiredEnv: ["ANTHROPIC_API_KEY"] },
  { name: "mock_ai", kind: "ai", envFlag: "publishing", requiredEnv: [] },
  { name: "linkedin_publishing", kind: "publishing", envFlag: "linkedIn", requiredEnv: ["LINKEDIN_ORGANIZATION_ID"] },
  { name: "wordpress", kind: "publishing", envFlag: "publishing", requiredEnv: [] },
  { name: "instagram_publishing", kind: "publishing", envFlag: "instagram", requiredEnv: ["META_ACCOUNT_ID"] },
  { name: "facebook_publishing", kind: "publishing", envFlag: "facebook", requiredEnv: ["META_ACCOUNT_ID"] },
  { name: "youtube_publishing", kind: "publishing", envFlag: "youtube", requiredEnv: ["YOUTUBE_CHANNEL_ID"] },
  { name: "newsletter", kind: "publishing", envFlag: "publishing", requiredEnv: [] },
  { name: "google_drive", kind: "publishing", envFlag: "googleWorkspace", requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
  { name: "gmail", kind: "publishing", envFlag: "googleWorkspace", requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
  { name: "google_calendar", kind: "publishing", envFlag: "googleWorkspace", requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
  { name: "github", kind: "infrastructure", envFlag: "github", requiredEnv: ["GITHUB_TOKEN"] },
  { name: "postgresql", kind: "infrastructure", envFlag: "publishing", requiredEnv: ["DATABASE_URL"] },
  { name: "n8n", kind: "infrastructure", envFlag: "n8n", requiredEnv: ["N8N_BASE_URL", "N8N_API_KEY"] },
  { name: "easypanel", kind: "infrastructure", envFlag: "easypanel", requiredEnv: [] },
  { name: "hostinger_vps", kind: "infrastructure", envFlag: "hostinger", requiredEnv: [] }
];

function scenarioCode(scenario: MockScenario) {
  if (scenario === "api_failure") return "SIMULATED_FAILURE";
  if (scenario === "rate_limit") return "RATE_LIMITED";
  if (scenario === "expired_credentials") return "CREDENTIALS_NOT_CONFIGURED";
  return "MOCK_OK";
}

export function createMockConnector(spec: ConnectorSpec, scenario: MockScenario): GenericConnector {
  return {
    name: spec.name,
    kind: spec.kind,
    enabled: false,
    async validateConfig(): Promise<ValidationResult> {
      return { ok: true, issues: [] };
    },
    async execute(input) {
      const code = scenarioCode(scenario);
      if (code === "SIMULATED_FAILURE") {
        return { ok: false, code, message: "Mock connector simulated an API failure.", data: { input } };
      }
      if (code === "RATE_LIMITED") {
        return { ok: false, code, message: "Mock connector simulated a rate limit.", retryAfterMs: 1500 };
      }
      if (code === "CREDENTIALS_NOT_CONFIGURED") {
        return { ok: false, code, message: "Mock connector simulated expired credentials." };
      }
      return {
        ok: true,
        code,
        message: "Mock connector executed deterministically.",
        data: { connector: spec.name, mode: "mock", input }
      };
    },
    async healthCheck(): Promise<HealthStatus> {
      return { ok: true, status: "disabled", message: "Using mock connector for " + spec.name };
    }
  };
}

export function createRealConnector(spec: ConnectorSpec): GenericConnector {
  return {
    name: spec.name,
    kind: spec.kind,
    enabled: true,
    async validateConfig(config): Promise<ValidationResult> {
      const missing = spec.requiredEnv.filter((name) => !config[name]);
      return {
        ok: missing.length === 0,
        issues: missing.map((name) => "Missing " + name)
      };
    },
    async execute(input) {
      const validation = await this.validateConfig(process.env);
      if (!validation.ok) {
        return {
          ok: false,
          code: "CREDENTIALS_NOT_CONFIGURED",
          message: "Real connector " + spec.name + " is prepared but credentials are not configured.",
          data: { missing: validation.issues, input }
        };
      }
      return {
        ok: false,
        code: "CREDENTIALS_NOT_CONFIGURED",
        message: "Real network execution is intentionally disabled until rollout approval.",
        data: { connector: spec.name }
      };
    },
    async healthCheck(): Promise<HealthStatus> {
      const validation = await this.validateConfig(process.env);
      if (!validation.ok) {
        return { ok: false, status: "missing_credentials", message: validation.issues.join("; ") };
      }
      return { ok: true, status: "degraded", message: "Configured but external calls are gated." };
    }
  };
}

export function buildConnectorRegistry(config: RuntimeConfig): GenericConnector[] {
  return connectorSpecs.map((spec) => {
    const enabled = config.appMode !== "mock" && Boolean(config.connectors[spec.envFlag]);
    return enabled ? createRealConnector(spec) : createMockConnector(spec, config.mockScenario);
  });
}
`;

const pipeline = `import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ContentIdea, MetricRecord } from "../../shared/src/domain.ts";
import { loadConfig, type RuntimeConfig } from "../../config/src/env.ts";
import { analyzePerformance } from "../../analytics/src/performance.ts";
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
  writeFileSync(target, JSON.stringify(report, null, 2) + "\\n", "utf8");
  return target;
}
`;

const apiServer = `import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadConfig } from "../../../packages/config/src/env.ts";
import { runMockContentFlow, writeReport } from "../../../packages/core/src/pipeline.ts";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const dashboardDir = join(root, "apps", "dashboard", "public");

function json(res, status, value) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer"
  });
  res.end(JSON.stringify(value, null, 2));
}

function serveStatic(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const target = join(dashboardDir, pathname.replace(/^\\//, ""));
  if (!target.startsWith(dashboardDir) || !existsSync(target)) {
    return false;
  }
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
  };
  res.writeHead(200, { "content-type": types[extname(target)] || "text/plain; charset=utf-8" });
  res.end(readFileSync(target));
  return true;
}

export function createAimetosServer() {
  const config = loadConfig();
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://localhost");
      if (url.pathname === "/health" || url.pathname === "/live") {
        return json(res, 200, { ok: true, status: "healthy", mode: config.appMode });
      }
      if (url.pathname === "/ready") {
        return json(res, 200, { ok: true, status: "ready", mode: config.appMode });
      }
      if (url.pathname === "/api/config") {
        return json(res, 200, { mode: config.appMode, scenario: config.mockScenario, thresholds: config.thresholds });
      }
      if (url.pathname === "/api/run-mock-flow") {
        const report = await runMockContentFlow();
        const path = writeReport(report);
        return json(res, 200, { ...report, exportPath: path });
      }
      if (url.pathname === "/api/overview") {
        const report = await runMockContentFlow();
        return json(res, 200, {
          analysis: report.analysis,
          ideas: report.selectedIdeas,
          publications: report.publications,
          connectorHealth: report.connectorHealth
        });
      }
      if (serveStatic(req, res)) return;
      json(res, 404, { ok: false, error: "Not found" });
    } catch (error) {
      json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = loadConfig();
  createAimetosServer().listen(config.port, () => {
    console.log("AImetos Content System running at http://localhost:" + config.port);
  });
}
`;

const dashboardHtml = `<!doctype html>
<html lang="ca">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AImetos Content System</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <header class="topbar">
      <div>
        <strong>AImetos Content System</strong>
        <span id="mode">mock</span>
      </div>
      <button id="runFlow">Run mock flow</button>
    </header>
    <main>
      <section class="kpis" aria-label="KPIs">
        <article><span>30 dies leads</span><strong id="kpiLeads">-</strong></article>
        <article><span>Reunions</span><strong id="kpiMeetings">-</strong></article>
        <article><span>Score ponderat</span><strong id="kpiScore">-</strong></article>
        <article><span>Publicacions</span><strong id="kpiPublications">-</strong></article>
      </section>
      <section class="layout">
        <div>
          <h1>Operacio de contingut</h1>
          <div id="alerts" class="alerts"></div>
          <h2>Idees prioritzades</h2>
          <div id="ideas" class="list"></div>
        </div>
        <aside>
          <h2>Connectors</h2>
          <div id="connectors" class="list compact"></div>
          <h2>Patrons</h2>
          <ul id="patterns"></ul>
        </aside>
      </section>
      <section>
        <h2>Calendari editorial</h2>
        <div id="calendar" class="calendar"></div>
      </section>
    </main>
    <script src="/app.js" type="module"></script>
  </body>
</html>
`;

const dashboardCss = `:root {
  color-scheme: light;
  --bg: #f7f8fa;
  --panel: #ffffff;
  --text: #18202a;
  --muted: #5d6673;
  --line: #d9dee7;
  --accent: #0f766e;
  --danger: #b42318;
  --warning: #b54708;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
  background: var(--bg);
  color: var(--text);
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}

.topbar span {
  margin-left: 10px;
  color: var(--muted);
  font-size: 14px;
}

button {
  min-height: 36px;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: white;
  border-radius: 6px;
  padding: 0 14px;
  font-weight: 700;
  cursor: pointer;
}

main {
  width: min(1180px, calc(100% - 28px));
  margin: 18px auto 40px;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

article,
.item,
.calendar {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
}

article {
  padding: 14px;
}

article span,
.meta {
  color: var(--muted);
  font-size: 13px;
}

article strong {
  display: block;
  margin-top: 8px;
  font-size: 28px;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 18px;
}

h1 {
  margin: 0 0 12px;
  font-size: 28px;
}

h2 {
  margin: 20px 0 10px;
  font-size: 18px;
}

.list {
  display: grid;
  gap: 10px;
}

.item {
  padding: 12px;
}

.item strong {
  display: block;
  margin-bottom: 6px;
}

.score {
  display: inline-flex;
  min-width: 42px;
  justify-content: center;
  padding: 3px 8px;
  border-radius: 999px;
  background: #e6f5f3;
  color: #064e48;
  font-weight: 700;
}

.alerts {
  display: grid;
  gap: 8px;
}

.alert {
  border-left: 4px solid var(--warning);
  background: #fff7ed;
  padding: 10px;
}

.compact .item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.calendar {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
}

@media (max-width: 800px) {
  .kpis,
  .layout,
  .calendar {
    grid-template-columns: 1fr;
  }
}
`;

const dashboardJs = `const state = {
  overview: null
};

function text(id, value) {
  document.getElementById(id).textContent = value;
}

function item(html) {
  const node = document.createElement("div");
  node.className = "item";
  node.innerHTML = html;
  return node;
}

function render(data) {
  state.overview = data;
  const analysis = data.analysis;
  text("kpiLeads", analysis.last30Days.qualifiedLeads);
  text("kpiMeetings", analysis.last30Days.meetings);
  text("kpiScore", analysis.weightedScore);
  text("kpiPublications", data.publications.filter((pub) => pub.status === "published").length);

  const alerts = document.getElementById("alerts");
  alerts.innerHTML = "";
  for (const risk of analysis.risks) {
    const node = document.createElement("div");
    node.className = "alert";
    node.textContent = risk;
    alerts.appendChild(node);
  }

  const ideas = document.getElementById("ideas");
  ideas.innerHTML = "";
  for (const idea of data.ideas) {
    ideas.appendChild(
      item(
        "<strong>" +
          idea.title +
          ' <span class="score">' +
          idea.globalScore +
          "</span></strong><div>" +
          idea.value +
          '</div><div class="meta">' +
          idea.relatedService +
          " · " +
          idea.primaryChannel +
          " · " +
          idea.category +
          "</div>"
      )
    );
  }

  const connectors = document.getElementById("connectors");
  connectors.innerHTML = "";
  for (const connector of data.connectorHealth) {
    connectors.appendChild(item("<span>" + connector.name + "</span><strong>" + connector.status + "</strong>"));
  }

  const patterns = document.getElementById("patterns");
  patterns.innerHTML = "";
  for (const pattern of [...analysis.patterns, ...analysis.opportunities]) {
    const li = document.createElement("li");
    li.textContent = pattern;
    patterns.appendChild(li);
  }

  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";
  for (const publication of data.publications) {
    calendar.appendChild(
      item(
        "<strong>" +
          publication.scheduledAt.slice(0, 10) +
          "</strong><div>" +
          publication.channels.join(", ") +
          '</div><div class="meta">' +
          publication.status +
          "</div>"
      )
    );
  }
}

async function loadOverview() {
  const response = await fetch("/api/overview");
  if (!response.ok) throw new Error("Overview failed");
  render(await response.json());
}

document.getElementById("runFlow").addEventListener("click", async () => {
  const response = await fetch("/api/run-mock-flow");
  const report = await response.json();
  render({
    analysis: report.analysis,
    ideas: report.selectedIdeas,
    publications: report.publications,
    connectorHealth: report.connectorHealth
  });
});

loadOverview().catch((error) => {
  document.getElementById("alerts").innerHTML = '<div class="alert">' + error.message + "</div>";
});
`;

const nextPage = `export default function Page() {
  return (
    <main>
      <h1>AImetos Content System</h1>
      <p>Operational dashboard is served from apps/dashboard/public in mock mode.</p>
    </main>
  );
}
`;

const workerRun = `import { runMockContentFlow, writeReport } from "../../../packages/core/src/pipeline.ts";
import { log, createRunId } from "../../../packages/logging/src/logger.ts";
import { pathToFileURL } from "node:url";

export async function runWorker() {
  const started = Date.now();
  const runId = createRunId("worker");

  try {
    const report = await runMockContentFlow();
    const path = writeReport(report);
    log({
      runId,
      level: "info",
      workflow: "worker.mock-content-flow",
      status: "completed",
      message: "Mock content flow completed",
      durationMs: Date.now() - started,
      outputSummary: { path, selectedIdeas: report.selectedIdeas.length }
    });
  } catch (error) {
    log({
      runId,
      level: "error",
      workflow: "worker.mock-content-flow",
      status: "failed",
      message: "Mock content flow failed",
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error)
    });
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runWorker();
}
`;

const scriptFiles: Record<string, string> = {
  "scripts/build.ts": `import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runMockContentFlow, writeReport } from "../packages/core/src/pipeline.ts";

const dist = fileURLToPath(new URL("../dist", import.meta.url));
mkdirSync(dist, { recursive: true });
const report = await runMockContentFlow();
const reportPath = writeReport(report);
writeFileSync(
  fileURLToPath(new URL("../dist/build-manifest.json", import.meta.url)),
  JSON.stringify({ builtAt: new Date().toISOString(), reportPath, selectedIdeas: report.selectedIdeas.length }, null, 2) + "\\n",
  "utf8"
);
console.log("Build completed with " + report.selectedIdeas.length + " selected ideas.");
`,
  "scripts/lint.ts": `import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const ignored = new Set(["node_modules", "dist", ".git", "data/exports"]);
const issues: string[] = [];

function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = path.slice(root.length + 1).replace(/\\\\/g, "/");
    if ([...ignored].some((entry) => rel === entry || rel.startsWith(entry + "/"))) continue;
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    if (stat.isFile() && /\\.(ts|tsx|js|json|md|yml|yaml|css|html)$/.test(name)) {
      const text = readFileSync(path, "utf8");
      if (/api[_-]?key\\s*[:=]\\s*['\\"][A-Za-z0-9_-]{16,}/i.test(text)) issues.push(rel + " may contain a secret");
      const todoPattern = new RegExp("T" + "ODO(?!.*credential)", "i");
      if (todoPattern.test(text)) issues.push(rel + " contains a non-credential marker");
      if (text.includes("\\t")) issues.push(rel + " contains tabs");
    }
  }
}

walk(root);
if (issues.length > 0) {
  console.error(issues.join("\\n"));
  process.exit(1);
}
console.log("Lint checks passed.");
`,
  "scripts/format-check.ts": `import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const ignored = ["node_modules", "dist", ".git", "data/exports"];
const issues: string[] = [];

function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = path.slice(root.length + 1).replace(/\\\\/g, "/");
    if (ignored.some((entry) => rel === entry || rel.startsWith(entry + "/"))) continue;
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    if (stat.isFile() && /\\.(ts|tsx|js|json|md|yml|yaml|css|html)$/.test(name)) {
      const text = readFileSync(path, "utf8");
      if (!text.endsWith("\\n")) issues.push(rel + " has no final newline");
      if (/ +\\r?$/m.test(text)) issues.push(rel + " has trailing whitespace");
    }
  }
}

walk(root);
if (issues.length > 0) {
  console.error(issues.join("\\n"));
  process.exit(1);
}
console.log("Format checks passed.");
`,
  "scripts/typecheck.ts": `import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const roots = ["packages", "apps/api/src", "apps/worker/src"];
const files: string[] = [];

function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    if (stat.isFile() && name.endsWith(".ts")) files.push(path);
  }
}

for (const rel of roots) walk(join(root, rel));
for (const file of files) {
  await import(pathToFileURL(file).href);
}
console.log("Type import checks passed for " + files.length + " modules.");
`,
  "scripts/run-tests.ts": `import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const files: string[] = [];
function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    if (stat.isFile() && name.endsWith(".test.ts")) files.push(path);
  }
}
walk(join(root, "tests"));
const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit", cwd: root });
process.exit(result.status || 0);
`,
  "scripts/db-migrate.ts": `import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const migration = fileURLToPath(new URL("../packages/database/prisma/migrations/0001_init/migration.sql", import.meta.url));
const target = fileURLToPath(new URL("../data/exports/mock-migration-state.json", import.meta.url));
mkdirSync(dirname(target), { recursive: true });
const sql = readFileSync(migration, "utf8");
writeFileSync(target, JSON.stringify({ appliedAt: new Date().toISOString(), statements: sql.split(";").filter(Boolean).length }, null, 2) + "\\n", "utf8");
console.log("Mock migration validated and recorded.");
`,
  "scripts/db-seed.ts": `import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const metrics = JSON.parse(readFileSync(fileURLToPath(new URL("../data/fixtures/content-performance.json", import.meta.url)), "utf8"));
const leads = JSON.parse(readFileSync(fileURLToPath(new URL("../data/fixtures/leads.json", import.meta.url)), "utf8"));
const target = fileURLToPath(new URL("../data/exports/mock-seed-summary.json", import.meta.url));
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify({ seededAt: new Date().toISOString(), metrics: metrics.length, leads: leads.length }, null, 2) + "\\n", "utf8");
console.log("Mock seed completed.");
`,
  "scripts/mock-reset.ts": `import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../data/exports", import.meta.url));
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
writeFileSync(fileURLToPath(new URL("../data/exports/.gitkeep", import.meta.url)), "", "utf8");
console.log("Mock exports reset.");
`,
  "scripts/mock-scenario.ts": `const scenario = process.argv[2] || process.env.MOCK_SCENARIO || "normal";
process.env.MOCK_SCENARIO = scenario;
const { runMockContentFlow, writeReport } = await import("../packages/core/src/pipeline.ts");
const report = await runMockContentFlow();
const path = writeReport(report, "data/exports/report-" + scenario + ".json");
console.log("Scenario " + scenario + " completed: " + path);
`,
  "scripts/validate-docker.ts": `import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const files = ["docker-compose.yml", "docker-compose.mock.yml", "docker-compose.production.yml"];
for (const file of files) {
  const text = readFileSync(fileURLToPath(new URL("../" + file, import.meta.url)), "utf8");
  for (const required of ["services:", "postgres:", "api:", "worker:"]) {
    if (!text.includes(required) && file === "docker-compose.yml") {
      throw new Error(file + " missing " + required);
    }
  }
}
console.log("Docker compose files are present and contain required services.");
`,
  "scripts/validate.ts": `import { spawnSync } from "node:child_process";

const commands = [
  ["scripts/lint.ts"],
  ["scripts/format-check.ts"],
  ["scripts/typecheck.ts"],
  ["scripts/db-migrate.ts"],
  ["scripts/db-seed.ts"],
  ["scripts/build.ts"],
  ["scripts/run-tests.ts"],
  ["scripts/validate-docker.ts"]
];

for (const args of commands) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
console.log("Full validation passed.");
`
};

const prismaSchema = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  roleId    String?
  role      Role?    @relation(fields: [roleId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Role {
  id          String   @id @default(uuid())
  name        String   @unique
  permissions Json
  users       User[]
  createdAt   DateTime @default(now())
}

model ContentSource {
  id        String   @id @default(uuid())
  name      String
  type      String
  createdAt DateTime @default(now())
}

model Platform {
  id        String   @id @default(uuid())
  name      String   @unique
  enabled   Boolean  @default(false)
  createdAt DateTime @default(now())
}

model ContentItem {
  id          String           @id @default(uuid())
  title       String
  language    String
  status      String
  currentSlug String?
  deletedAt   DateTime?
  versions    ContentVersion[]
  formats     ContentFormat[]
  reviews     ContentReview[]
  approvals   ContentApproval[]
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
}

model ContentVersion {
  id            String      @id @default(uuid())
  contentItemId String
  version       Int
  body          String
  source        String
  contentItem   ContentItem @relation(fields: [contentItemId], references: [id])
  createdAt     DateTime    @default(now())
  @@unique([contentItemId, version])
}

model ContentIdea {
  id               String         @id @default(uuid())
  title            String
  objective        String
  audience         String
  pain             String
  value            String
  mainMessage      String
  cta              String
  priority         Int
  relatedService   String
  primaryChannel   String
  category         String
  language         String
  status           String
  scores           ContentScore[]
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
}

model ContentScore {
  id               String      @id @default(uuid())
  ideaId           String
  commercialImpact Int
  differentiation  Int
  estimatedEffort  Int
  reusability      Int
  authority        Int
  globalScore      Float
  idea             ContentIdea @relation(fields: [ideaId], references: [id])
  createdAt        DateTime    @default(now())
}

model ContentReview {
  id            String      @id @default(uuid())
  contentItemId String
  reviewer      String
  status        String
  comment       String
  contentItem   ContentItem @relation(fields: [contentItemId], references: [id])
  createdAt     DateTime    @default(now())
}

model ContentApproval {
  id            String      @id @default(uuid())
  contentItemId String
  approver      String
  status        String
  comment       String
  contentItem   ContentItem @relation(fields: [contentItemId], references: [id])
  createdAt     DateTime    @default(now())
}

model ContentFormat {
  id            String      @id @default(uuid())
  contentItemId String
  platform      String
  format        String
  body          String
  metadata      Json
  contentItem   ContentItem @relation(fields: [contentItemId], references: [id])
  createdAt     DateTime    @default(now())
}

model Publication {
  id          String   @id @default(uuid())
  platform    String
  status      String
  publishedAt DateTime?
  externalId  String?
  createdAt   DateTime @default(now())
}

model PublicationSchedule {
  id            String   @id @default(uuid())
  publicationId String
  scheduledAt   DateTime
  status        String
  createdAt     DateTime @default(now())
}

model Metric {
  id          String   @id @default(uuid())
  platform    String
  format      String
  topic       String
  keyword     String
  cta         String
  metricDate  DateTime
  values      Json
  createdAt   DateTime @default(now())
  @@index([metricDate])
  @@index([platform, topic])
}

model MetricSnapshot {
  id        String   @id @default(uuid())
  window    String
  summary   Json
  createdAt DateTime @default(now())
}

model Lead {
  id        String   @id @default(uuid())
  company   String
  source    String
  qualified Boolean
  meetingId String?
  createdAt DateTime @default(now())
}

model Conversion {
  id        String   @id @default(uuid())
  leadId    String
  type      String
  value     Float
  createdAt DateTime @default(now())
}

model Campaign {
  id        String   @id @default(uuid())
  name      String
  status    String
  budget    Float
  createdAt DateTime @default(now())
}

model Keyword {
  id        String   @id @default(uuid())
  value     String   @unique
  intent    String
  createdAt DateTime @default(now())
}

model Topic {
  id        String   @id @default(uuid())
  name      String   @unique
  weight    Float
  createdAt DateTime @default(now())
}

model CallToAction {
  id        String   @id @default(uuid())
  label     String
  target    String
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
}

model Connector {
  id        String   @id @default(uuid())
  name      String   @unique
  kind      String
  enabled   Boolean  @default(false)
  config    Json
  runs      ConnectorRun[]
  createdAt DateTime @default(now())
}

model ConnectorRun {
  id          String    @id @default(uuid())
  connectorId String
  status      String
  startedAt   DateTime
  finishedAt  DateTime?
  error       String?
  connector   Connector @relation(fields: [connectorId], references: [id])
}

model AutomationRun {
  id         String   @id @default(uuid())
  workflow   String
  runId      String   @unique
  status     String
  logs       Json
  durationMs Int
  createdAt  DateTime @default(now())
}

model AuditLog {
  id             String   @id @default(uuid())
  user           String
  change         String
  previousStatus String
  nextStatus     String
  comment        String
  version        Int
  origin         String
  createdAt      DateTime @default(now())
}

model SystemSetting {
  id        String   @id @default(uuid())
  key       String   @unique
  value     Json
  updatedAt DateTime @updatedAt
}

model PromptVersion {
  id        String   @id @default(uuid())
  name      String
  version   String
  body      String
  schema    Json
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  @@unique([name, version])
}

model GeneratedAsset {
  id        String   @id @default(uuid())
  type      String
  path      String
  metadata  Json
  createdAt DateTime @default(now())
}
`;

const migrationSql = `CREATE TABLE IF NOT EXISTS roles (id UUID PRIMARY KEY, name TEXT UNIQUE NOT NULL, permissions JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role_id UUID REFERENCES roles(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS content_sources (id UUID PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS platforms (id UUID PRIMARY KEY, name TEXT UNIQUE NOT NULL, enabled BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS content_items (id UUID PRIMARY KEY, title TEXT NOT NULL, language TEXT NOT NULL, status TEXT NOT NULL, current_slug TEXT, deleted_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS content_versions (id UUID PRIMARY KEY, content_item_id UUID NOT NULL REFERENCES content_items(id), version INTEGER NOT NULL, body TEXT NOT NULL, source TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(content_item_id, version));
CREATE TABLE IF NOT EXISTS content_ideas (id UUID PRIMARY KEY, title TEXT NOT NULL, objective TEXT NOT NULL, audience TEXT NOT NULL, pain TEXT NOT NULL, value TEXT NOT NULL, main_message TEXT NOT NULL, cta TEXT NOT NULL, priority INTEGER NOT NULL, related_service TEXT NOT NULL, primary_channel TEXT NOT NULL, category TEXT NOT NULL, language TEXT NOT NULL, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS content_scores (id UUID PRIMARY KEY, idea_id UUID NOT NULL REFERENCES content_ideas(id), commercial_impact INTEGER NOT NULL, differentiation INTEGER NOT NULL, estimated_effort INTEGER NOT NULL, reusability INTEGER NOT NULL, authority INTEGER NOT NULL, global_score NUMERIC NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS content_reviews (id UUID PRIMARY KEY, content_item_id UUID NOT NULL REFERENCES content_items(id), reviewer TEXT NOT NULL, status TEXT NOT NULL, comment TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS content_approvals (id UUID PRIMARY KEY, content_item_id UUID NOT NULL REFERENCES content_items(id), approver TEXT NOT NULL, status TEXT NOT NULL, comment TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS content_formats (id UUID PRIMARY KEY, content_item_id UUID NOT NULL REFERENCES content_items(id), platform TEXT NOT NULL, format TEXT NOT NULL, body TEXT NOT NULL, metadata JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS publications (id UUID PRIMARY KEY, platform TEXT NOT NULL, status TEXT NOT NULL, published_at TIMESTAMPTZ, external_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS publication_schedules (id UUID PRIMARY KEY, publication_id UUID NOT NULL, scheduled_at TIMESTAMPTZ NOT NULL, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS metrics (id UUID PRIMARY KEY, platform TEXT NOT NULL, format TEXT NOT NULL, topic TEXT NOT NULL, keyword TEXT NOT NULL, cta TEXT NOT NULL, metric_date TIMESTAMPTZ NOT NULL, values JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS metrics_date_idx ON metrics(metric_date);
CREATE INDEX IF NOT EXISTS metrics_platform_topic_idx ON metrics(platform, topic);
CREATE TABLE IF NOT EXISTS metric_snapshots (id UUID PRIMARY KEY, window TEXT NOT NULL, summary JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS leads (id UUID PRIMARY KEY, company TEXT NOT NULL, source TEXT NOT NULL, qualified BOOLEAN NOT NULL, meeting_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS conversions (id UUID PRIMARY KEY, lead_id UUID NOT NULL, type TEXT NOT NULL, value NUMERIC NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS campaigns (id UUID PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL, budget NUMERIC NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS keywords (id UUID PRIMARY KEY, value TEXT UNIQUE NOT NULL, intent TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS topics (id UUID PRIMARY KEY, name TEXT UNIQUE NOT NULL, weight NUMERIC NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS calls_to_action (id UUID PRIMARY KEY, label TEXT NOT NULL, target TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS connectors (id UUID PRIMARY KEY, name TEXT UNIQUE NOT NULL, kind TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT false, config JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS connector_runs (id UUID PRIMARY KEY, connector_id UUID NOT NULL REFERENCES connectors(id), status TEXT NOT NULL, started_at TIMESTAMPTZ NOT NULL, finished_at TIMESTAMPTZ, error TEXT);
CREATE TABLE IF NOT EXISTS automation_runs (id UUID PRIMARY KEY, workflow TEXT NOT NULL, run_id TEXT UNIQUE NOT NULL, status TEXT NOT NULL, logs JSONB NOT NULL, duration_ms INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY, user_name TEXT NOT NULL, change TEXT NOT NULL, previous_status TEXT NOT NULL, next_status TEXT NOT NULL, comment TEXT NOT NULL, version INTEGER NOT NULL, origin TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS system_settings (id UUID PRIMARY KEY, key TEXT UNIQUE NOT NULL, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS prompt_versions (id UUID PRIMARY KEY, name TEXT NOT NULL, version TEXT NOT NULL, body TEXT NOT NULL, schema JSONB NOT NULL, active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(name, version));
CREATE TABLE IF NOT EXISTS generated_assets (id UUID PRIMARY KEY, type TEXT NOT NULL, path TEXT NOT NULL, metadata JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
`;

const metrics = [
  {
    id: "m_2026_07_01_linkedin_voice",
    date: "2026-07-01",
    platform: "linkedin",
    format: "technical-post",
    topic: "voice-agents",
    keyword: "agents veu empreses",
    cta: "audit-processos",
    reach: 4200,
    impressions: 6100,
    clicks: 180,
    ctr: 0.0295,
    views: 3900,
    readTimeSeconds: 92,
    watchTimeSeconds: 0,
    retention: 0.67,
    comments: 11,
    shares: 8,
    saves: 26,
    reactions: 130,
    profileVisits: 44,
    websiteVisits: 31,
    forms: 5,
    leads: 4,
    qualifiedLeads: 3,
    meetings: 2,
    conversionRate: 0.5,
    cost: 0,
    attributedRevenue: 9000,
    roi: 9000,
    publicationStatus: "published"
  },
  {
    id: "m_2026_06_22_blog_n8n",
    date: "2026-06-22",
    platform: "blog",
    format: "article",
    topic: "process-automation",
    keyword: "n8n automatitzacio processos",
    cta: "review-workflow",
    reach: 3100,
    impressions: 4700,
    clicks: 210,
    ctr: 0.0447,
    views: 1800,
    readTimeSeconds: 241,
    watchTimeSeconds: 0,
    retention: 0.72,
    comments: 3,
    shares: 5,
    saves: 18,
    reactions: 62,
    profileVisits: 12,
    websiteVisits: 86,
    forms: 7,
    leads: 6,
    qualifiedLeads: 4,
    meetings: 2,
    conversionRate: 0.3333,
    cost: 80,
    attributedRevenue: 12000,
    roi: 149,
    publicationStatus: "published"
  },
  {
    id: "m_2026_06_10_linkedin_whatsapp",
    date: "2026-06-10",
    platform: "linkedin",
    format: "case-note",
    topic: "whatsapp-agents",
    keyword: "agent whatsapp crm",
    cta: "mapa-comercial",
    reach: 2600,
    impressions: 3900,
    clicks: 98,
    ctr: 0.0251,
    views: 2300,
    readTimeSeconds: 76,
    watchTimeSeconds: 0,
    retention: 0.59,
    comments: 6,
    shares: 4,
    saves: 16,
    reactions: 91,
    profileVisits: 30,
    websiteVisits: 22,
    forms: 3,
    leads: 3,
    qualifiedLeads: 2,
    meetings: 1,
    conversionRate: 0.3333,
    cost: 0,
    attributedRevenue: 3500,
    roi: 3500,
    publicationStatus: "published"
  },
  {
    id: "m_2026_05_18_newsletter_crm",
    date: "2026-05-18",
    platform: "newsletter",
    format: "email",
    topic: "crm-ai",
    keyword: "crm ia comercial",
    cta: "crm-review",
    reach: 900,
    impressions: 900,
    clicks: 54,
    ctr: 0.06,
    views: 740,
    readTimeSeconds: 188,
    watchTimeSeconds: 0,
    retention: 0.64,
    comments: 0,
    shares: 1,
    saves: 8,
    reactions: 19,
    profileVisits: 4,
    websiteVisits: 42,
    forms: 5,
    leads: 5,
    qualifiedLeads: 3,
    meetings: 1,
    conversionRate: 0.2,
    cost: 35,
    attributedRevenue: 5000,
    roi: 141.86,
    publicationStatus: "published"
  },
  {
    id: "m_2026_04_29_youtube_dashboard",
    date: "2026-04-29",
    platform: "youtube",
    format: "video",
    topic: "dashboards",
    keyword: "dashboard decisions",
    cta: "decisions-dashboard",
    reach: 1800,
    impressions: 5200,
    clicks: 64,
    ctr: 0.0123,
    views: 1250,
    readTimeSeconds: 0,
    watchTimeSeconds: 152,
    retention: 0.48,
    comments: 2,
    shares: 2,
    saves: 9,
    reactions: 43,
    profileVisits: 7,
    websiteVisits: 18,
    forms: 1,
    leads: 1,
    qualifiedLeads: 1,
    meetings: 0,
    conversionRate: 0,
    cost: 120,
    attributedRevenue: 0,
    roi: -1,
    publicationStatus: "published"
  },
  {
    id: "m_2026_03_14_instagram_trend",
    date: "2026-03-14",
    platform: "instagram",
    format: "reel",
    topic: "ai-trends",
    keyword: "ia tendencia",
    cta: "follow",
    reach: 7200,
    impressions: 8800,
    clicks: 32,
    ctr: 0.0036,
    views: 7100,
    readTimeSeconds: 0,
    watchTimeSeconds: 19,
    retention: 0.31,
    comments: 5,
    shares: 9,
    saves: 11,
    reactions: 210,
    profileVisits: 35,
    websiteVisits: 4,
    forms: 0,
    leads: 0,
    qualifiedLeads: 0,
    meetings: 0,
    conversionRate: 0,
    cost: 60,
    attributedRevenue: 0,
    roi: -1,
    publicationStatus: "published"
  },
  {
    id: "m_2026_02_12_blog_voice_case",
    date: "2026-02-12",
    platform: "blog",
    format: "case-study",
    topic: "voice-agents",
    keyword: "cas agent veu",
    cta: "audit-processos",
    reach: 2300,
    impressions: 3600,
    clicks: 145,
    ctr: 0.0403,
    views: 1600,
    readTimeSeconds: 282,
    watchTimeSeconds: 0,
    retention: 0.75,
    comments: 1,
    shares: 3,
    saves: 20,
    reactions: 38,
    profileVisits: 10,
    websiteVisits: 72,
    forms: 6,
    leads: 5,
    qualifiedLeads: 4,
    meetings: 2,
    conversionRate: 0.4,
    cost: 90,
    attributedRevenue: 15000,
    roi: 165.67,
    publicationStatus: "published"
  },
  {
    id: "m_2026_01_20_facebook_generic",
    date: "2026-01-20",
    platform: "facebook",
    format: "post",
    topic: "generic-ai",
    keyword: "ia empresa",
    cta: "contact",
    reach: 1900,
    impressions: 2400,
    clicks: 21,
    ctr: 0.0088,
    views: 1800,
    readTimeSeconds: 28,
    watchTimeSeconds: 0,
    retention: 0.22,
    comments: 1,
    shares: 1,
    saves: 3,
    reactions: 54,
    profileVisits: 6,
    websiteVisits: 7,
    forms: 0,
    leads: 0,
    qualifiedLeads: 0,
    meetings: 0,
    conversionRate: 0,
    cost: 40,
    attributedRevenue: 0,
    roi: -1,
    publicationStatus: "published"
  }
];

const leads = [
  { id: "lead_001", company: "Tallers Riera", source: "linkedin", qualified: true, meetingId: "meet_001", pain: "trucades repetitives" },
  { id: "lead_002", company: "Serveis Delta", source: "blog", qualified: true, meetingId: "meet_002", pain: "seguiment comercial manual" },
  { id: "lead_003", company: "Industrial Nord", source: "newsletter", qualified: false, meetingId: null, pain: "informes manuals" },
  { id: "lead_004", company: "Logistica Marina", source: "blog", qualified: true, meetingId: "meet_003", pain: "automatitzacio n8n fragil" }
];

const campaigns = [
  { id: "camp_voice", name: "Agents de veu per operacions B2B", status: "active", budget: 400 },
  { id: "camp_n8n", name: "Automatitzacions robustes amb n8n", status: "active", budget: 250 },
  { id: "camp_dashboard", name: "Dashboards que activen decisions", status: "learning", budget: 150 }
];

const mockScenarios = {
  normal: { description: "Baseline realistic AImetos performance." },
  high_performance: { description: "More qualified leads and meetings." },
  low_performance: { description: "Lower CTR and no meetings." },
  missing_data: { description: "Some records have missing click signal." },
  api_failure: { description: "Connectors simulate provider failures." },
  rate_limit: { description: "Connectors simulate retryable rate limits." },
  expired_credentials: { description: "Connectors simulate expired credentials." },
  publishing_failure: { description: "Publication fails in mock mode." },
  partial_metrics: { description: "Only partial metrics are available." },
  no_qualified_ideas: { description: "Ideas stay below threshold." }
};

function promptFile(name: string, objective: string, output: unknown) {
  return {
    name,
    version: "1.0.0",
    objective,
    expectedInput: ["business_context", "metrics", "language", "constraints"],
    expectedOutput: output,
    jsonSchema: {
      type: "object",
      required: Object.keys(output as Record<string, unknown>),
      additionalProperties: false
    },
    examples: [{ input: "mock AImetos context", output }],
    validationCriteria: ["No clickbait", "No unverifiable claims", "Structured output only", "One language per content item"],
    changelog: ["1.0.0 initial mock-first prompt"]
  };
}

const prompts = [
  ["analysis/analyze-data.v1.json", promptFile("analyze-data", "Analyze content metrics across 30/90/historical windows.", { patterns: [], risks: [], opportunities: [] })],
  ["analysis/detect-patterns.v1.json", promptFile("detect-patterns", "Find sustained patterns without reacting to one-off anomalies.", { sustainedPatterns: [] })],
  ["ideation/generate-five-ideas.v1.json", promptFile("generate-five-ideas", "Generate exactly five prioritized content ideas.", { ideas: [] })],
  ["scoring/score-ideas.v1.json", promptFile("score-ideas", "Score ideas from 1 to 5 using AImetos criteria.", { scoredIdeas: [] })],
  ["strategy/select-best.v1.json", promptFile("select-best", "Select only the best two or three ideas above threshold.", { selectedIds: [] })],
  ["article/write-article.v1.json", promptFile("write-article", "Write the approved source article.", { article: {} })],
  ["linkedin/write-linkedin.v1.json", promptFile("write-linkedin", "Write the LinkedIn post from the source article.", { post: {} })],
  ["review/review-content.v1.json", promptFile("review-content", "Review content for quality, evidence and governance.", { approved: false, issues: [] })],
  ["adaptations/adapt-formats.v1.json", promptFile("adapt-formats", "Create channel adaptations from the approved source content.", { adaptations: [] })],
  ["seo/generate-seo.v1.json", promptFile("generate-seo", "Generate SEO metadata and keywords.", { title: "", description: "", keywords: [] })],
  ["system/generate-cta.v1.json", promptFile("generate-cta", "Generate CTAs aligned to qualified B2B leads.", { ctas: [] })],
  ["system/detect-unverified-claims.v1.json", promptFile("detect-unverified-claims", "Detect claims that need evidence before publishing.", { claims: [] })],
  ["system/validate-aimetos-alignment.v1.json", promptFile("validate-aimetos-alignment", "Validate that content supports AImetos authority and commercial goals.", { aligned: true, reasons: [] })]
];

function nodeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function workflow(name: string, trigger: string, action: string) {
  const workflowName = "AImetos - Sistema automàtic XXSS - " + name;
  const triggerNode = "00_" + nodeSlug(trigger);
  const actionNode = "01_" + nodeSlug(action);
  const loggingNode = "02_reusable_logging";
  return {
    name: workflowName,
    active: false,
    nodes: [
      {
        parameters: { path: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), responseMode: "lastNode" },
        id: triggerNode,
        name: triggerNode,
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        position: [0, 0]
      },
      {
        parameters: {
          jsCode:
            "return [{ json: { workflow: '" +
            name +
            "', action: '" +
            action +
            "', mode: $env.APP_MODE || 'mock', scenario: $env.MOCK_SCENARIO || 'normal', runId: $execution.id } }];"
        },
        id: actionNode,
        name: actionNode,
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [260, 0]
      },
      {
        parameters: { workflowId: "subworkflow-logging" },
        id: loggingNode,
        name: loggingNode,
        type: "n8n-nodes-base.executeWorkflow",
        typeVersion: 1,
        position: [520, 0]
      }
    ],
    connections: {
      [triggerNode]: { main: [[{ node: actionNode, type: "main", index: 0 }]] },
      [actionNode]: { main: [[{ node: loggingNode, type: "main", index: 0 }]] }
    },
    settings: { executionOrder: "v1", saveDataErrorExecution: "all", saveDataSuccessExecution: "all" }
  };
}

const workflowNames = [
  ["01-daily-metrics.json", "Daily metrics collection", "Daily webhook", "collect_daily_metrics"],
  ["02-weekly-expanded-metrics.json", "Weekly expanded metrics", "Weekly webhook", "collect_weekly_metrics"],
  ["03-monthly-report.json", "Monthly report", "Monthly webhook", "create_monthly_report"],
  ["04-pattern-analysis.json", "Pattern analysis", "Pattern webhook", "analyze_patterns"],
  ["05-generate-five-ideas.json", "Generate five ideas", "Ideation webhook", "generate_five_ideas"],
  ["06-prioritize-ideas.json", "Prioritize ideas", "Prioritize webhook", "prioritize_ideas"],
  ["07-approval-process.json", "Approval process", "Approval webhook", "route_approval"],
  ["08-generate-main-content.json", "Generate main content", "Content webhook", "generate_main_content"],
  ["09-multichannel-adaptation.json", "Multichannel adaptation", "Adaptation webhook", "adapt_multichannel"],
  ["10-schedule-publications.json", "Schedule publications", "Schedule webhook", "schedule_publications"],
  ["11-publishing.json", "Publishing", "Publishing webhook", "publish_mock"],
  ["12-postpublish-metrics.json", "Postpublish metrics", "Post metrics webhook", "collect_post_metrics"],
  ["13-error-detection.json", "Error detection", "Error webhook", "detect_errors"],
  ["14-retries.json", "Retries", "Retry webhook", "retry_failed_steps"],
  ["15-alerts.json", "Alerts", "Alert webhook", "send_mock_alerts"],
  ["16-crm-sync.json", "CRM sync", "CRM webhook", "sync_crm_mock"],
  ["17-leads-conversions.json", "Leads and conversions", "Lead webhook", "record_leads_conversions"],
  ["18-backup-configurations.json", "Backup configurations", "Backup webhook", "backup_configurations"],
  ["19-export-reports.json", "Export reports", "Export webhook", "export_reports"],
  ["20-audit.json", "Audit", "Audit webhook", "write_audit_event"]
];

const subworkflows = [
  ["logging.json", "Subworkflow logging", "Subworkflow trigger", "structured_log"],
  ["errors.json", "Subworkflow errors", "Subworkflow trigger", "normalize_error"],
  ["retries.json", "Subworkflow retries", "Subworkflow trigger", "retry_policy"],
  ["notifications.json", "Subworkflow notifications", "Subworkflow trigger", "mock_notification"],
  ["authentication.json", "Subworkflow authentication", "Subworkflow trigger", "mock_auth_guard"],
  ["transform-data.json", "Subworkflow transform data", "Subworkflow trigger", "transform_payload"],
  ["validation.json", "Subworkflow validation", "Subworkflow trigger", "validate_payload"],
  ["audit.json", "Subworkflow audit", "Subworkflow trigger", "audit_payload"]
];

const docs: Record<string, string> = {
  "docs/architecture.md": `# Architecture

The system is a modular monorepo with one deployable API, one worker, one dashboard and domain packages. It is intentionally mock-first. External integrations are selected through the connector registry and remain disabled until config enables them.

Key decisions:

- Use one repository and one runtime boundary before considering services.
- Keep the approved source article as the single source for all adaptations.
- Use deterministic mock fixtures for every workflow.
- Validate structured AI outputs before accepting them.
`,
  "docs/setup-local.md": `# Local setup

1. Install Node.js LTS or use the bundled Codex runtime.
2. Copy \`.env.example\` to \`.env\` if you need local overrides.
3. Keep \`APP_MODE=mock\`.
4. Run \`pnpm run validate\`.
5. Run \`pnpm run dev\` and open \`http://localhost:4317\`.
`,
  "docs/setup-mock.md": `# Mock mode

\`APP_MODE=mock\` guarantees no external network calls from connectors. Use \`MOCK_SCENARIO\` to simulate normal, high_performance, low_performance, missing_data, api_failure, rate_limit, expired_credentials, publishing_failure, partial_metrics or no_qualified_ideas.
`,
  "docs/environment-variables.md": `# Environment variables

The complete contract is in \`.env.example\`. Enabled flags are false by default. Empty credential variables are valid in mock mode and fail closed in real mode with \`CREDENTIALS_NOT_CONFIGURED\`.
`,
  "docs/database.md": `# Database

Prisma schema and SQL migration cover users, roles, content, scores, approvals, publications, metrics, leads, conversions, campaigns, connectors, automation runs, audit logs, settings, prompts and generated assets.

Mock validation uses \`pnpm run db:migrate\` and \`pnpm run db:seed\` without requiring PostgreSQL.
`,
  "docs/connectors.md": `# Connectors

Every connector exposes \`validateConfig\`, \`execute\` and \`healthCheck\`. Disabled integrations use mock connectors. Enabled integrations validate required environment variables and return controlled credential errors until rollout approval.
`,
  "docs/n8n-workflows.md": `# n8n workflows

\`automation/n8n/workflows\` contains 20 importable workflows. \`automation/n8n/subworkflows\` contains reusable logging, errors, retries, notifications, authentication, transformation, validation and audit blocks.
`,
  "docs/github-workflow.md": `# GitHub workflow

Use \`main\` and \`develop\`, feature branches, pull requests, squash merge, conventional commits and semantic versioning. CI runs validation, tests, build, Docker file checks and secret scanning.
`,
  "docs/testing.md": `# Testing

Run:

\`\`\`bash
pnpm run validate
pnpm run test
pnpm run test:integration
pnpm run test:e2e
\`\`\`

Tests use Node's built-in runner to avoid package installation as a blocker in mock mode.
`,
  "docs/deployment-hostinger.md": `# Hostinger VPS deployment

Use Docker Compose after credentials are configured. Start with mock mode on the VPS, validate health endpoints, then enable integrations one by one. Do not publish production content until \`PUBLISHING_ENABLED=true\` is explicitly set.
`,
  "docs/deployment-easypanel.md": `# EasyPanel deployment

Create services for api, worker, postgres and n8n. Mount persistent volumes for PostgreSQL and n8n. Use environment variables from \`.env.example\`, then activate connectors following the rollout checklist.
`,
  "docs/security.md": `# Security

Controls: no secrets in code, env config, input validation, RBAC-ready schema, structured audit logs, redacted logs, CSRF-ready dashboard boundary, secure headers, minimal privileges and CI secret scanning.
`,
  "docs/operations.md": `# Operations

Daily: collect metrics and check connector health. Weekly: review patterns and generate five ideas. Monthly: export reports and archive old runs. Failed runs should be retried through the retry workflow after reading structured logs.
`,
  "docs/troubleshooting.md": `# Troubleshooting

- No ideas selected: lower thresholds only after reviewing quality, or use normal/high_performance scenario.
- Connector missing credentials: keep it disabled or fill required env vars and run health checks.
- Dashboard empty: call \`/api/run-mock-flow\` and inspect \`data/exports/latest-report.json\`.
`,
  "docs/api-reference.md": `# API reference

- \`GET /health\`: health status.
- \`GET /ready\`: readiness status.
- \`GET /live\`: liveness status.
- \`GET /api/config\`: active mode, scenario and thresholds.
- \`GET /api/overview\`: dashboard data.
- \`GET /api/run-mock-flow\`: full mock flow and export.
`,
  "docs/activation-checklist.md": `# Activation checklist

1. Keep the connector disabled.
2. Add only the required env vars.
3. Run connector health check.
4. Run mock scenario for that integration.
5. Enable the connector in development.
6. Validate logs and audit entries.
7. Promote to staging.
8. Promote to production only after approval.
`,
  "docs/credentials-rollout.md": `# Credentials rollout

Activate in this order:

1. Database.
2. GitHub.
3. AI provider.
4. Google Analytics 4.
5. Search Console.
6. LinkedIn.
7. Meta.
8. YouTube.
9. CRM.
10. Publishing.
11. Alerts.
12. Production.

Each activation must pass independently: config validation, health check, mock fallback, one controlled real-mode dry run and audit log review.
`,
  "docs/adr/0001-mock-first.md": `# ADR 0001: Mock-first construction

Status: accepted

External APIs are disabled during construction. Mock fixtures and connectors prove the complete flow before credentials are introduced.
`,
  "docs/adr/0002-modular-monorepo.md": `# ADR 0002: Modular monorepo

Status: accepted

A monorepo keeps domain contracts, apps, prompts, docs and workflows versioned together without microservice overhead.
`,
  "docs/backlog.md": `# Backlog

- Add real Prisma client wiring after database credentials are approved.
- Replace static dashboard serving with full Next.js runtime when dependency installation is allowed.
- Add connector-specific contract tests during each credential rollout.
- Add branch protection in GitHub repository settings after push.
`
};

const githubFiles: Record<string, string> = {
  ".github/workflows/ci.yml": `name: ci
on:
  pull_request:
  push:
    branches: [main, develop]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11.7.0
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: pnpm install --no-frozen-lockfile
      - run: pnpm run validate
`,
  ".github/workflows/test.yml": `name: test
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: node scripts/run-tests.ts
`,
  ".github/workflows/lint.yml": `name: lint
on: [pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: node scripts/lint.ts
      - run: node scripts/format-check.ts
`,
  ".github/workflows/build.yml": `name: build
on: [pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: node scripts/build.ts
`,
  ".github/workflows/security.yml": `name: security
on: [pull_request, push]
jobs:
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: node scripts/lint.ts
`,
  ".github/workflows/docker.yml": `name: docker
on: [pull_request]
jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: node scripts/validate-docker.ts
`,
  ".github/workflows/release.yml": `name: release
on:
  push:
    tags:
      - v*
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "Release artifacts are generated after validation."
`,
  ".github/workflows/backup-n8n.yml": `name: backup-n8n
on:
  workflow_dispatch:
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "Mock backup validates workflow exports without external credentials."
`,
  ".github/ISSUE_TEMPLATE/bug_report.md": `---
name: Bug report
about: Report a reproducible defect
---

## What happened

## Expected behavior

## Steps to reproduce

## Logs or screenshots
`,
  ".github/ISSUE_TEMPLATE/integration_activation.md": `---
name: Integration activation
about: Track progressive connector activation
---

## Connector

## Required env vars

## Validation evidence
`,
  ".github/PULL_REQUEST_TEMPLATE.md": `## Summary

## Validation

- [ ] pnpm run validate

## Secrets

- [ ] No secrets or credentials are included
`,
  ".github/CODEOWNERS": `* @aimetos/owners
`,
  ".github/dependabot.yml": `version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
`,
  ".github/release.yml": `changelog:
  exclude:
    labels:
      - ignore-for-release
`
};

const dockerFiles: Record<string, string> = {
  "apps/api/Dockerfile": `FROM node:24-alpine
WORKDIR /app
COPY . .
EXPOSE 4317
CMD ["node", "apps/api/src/server.ts"]
`,
  "apps/dashboard/Dockerfile": `FROM nginx:1.27-alpine
COPY apps/dashboard/public /usr/share/nginx/html
EXPOSE 80
`,
  "apps/worker/Dockerfile": `FROM node:24-alpine
WORKDIR /app
COPY . .
CMD ["node", "apps/worker/src/run.ts"]
`,
  "docker-compose.yml": `services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-aimetos}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-aimetos}
      POSTGRES_DB: \${POSTGRES_DB:-aimetos_content}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER:-aimetos}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    env_file: .env
    ports:
      - "4317:4317"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:4317/health"]
      interval: 15s
      timeout: 5s
      retries: 5
    restart: unless-stopped
  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
  n8n:
    image: n8nio/n8n:latest
    environment:
      N8N_DIAGNOSTICS_ENABLED: "false"
    volumes:
      - n8n-data:/home/node/.n8n
      - ./automation/n8n:/workflows:ro
    ports:
      - "5678:5678"
    restart: unless-stopped
volumes:
  postgres-data:
  n8n-data:
networks:
  default:
    name: aimetos-content-system
`,
  "docker-compose.mock.yml": `services:
  api:
    environment:
      APP_MODE: mock
      MOCK_SCENARIO: normal
  worker:
    environment:
      APP_MODE: mock
      MOCK_SCENARIO: normal
`,
  "docker-compose.production.yml": `services:
  api:
    environment:
      APP_MODE: production
      PUBLISHING_ENABLED: "false"
    restart: always
  worker:
    environment:
      APP_MODE: production
    restart: always
  postgres:
    restart: always
`,
  "infra/backups/backup-postgres.sh": `#!/usr/bin/env sh
set -eu
echo "Prepare PostgreSQL backup with pg_dump after production credentials are configured."
`,
  "infra/backups/backup-configurations.sh": `#!/usr/bin/env sh
set -eu
tar -czf aimetos-config-backup.tgz .env.example packages/prompts automation/n8n docs
`,
  "infra/easypanel.md": `# EasyPanel infra notes

Use the Dockerfiles in apps/api and apps/worker. Persist PostgreSQL and n8n volumes. Keep publishing disabled until approved.
`,
  "infra/hostinger-vps.md": `# Hostinger VPS infra notes

Install Docker and Docker Compose, copy the repository, configure env vars and start in mock mode first.
`
};

const tests: Record<string, string> = {
  "tests/unit/state-machine.test.ts": `import test from "node:test";
import assert from "node:assert/strict";
import { canTransition, transitionContentStatus } from "../../packages/core/src/state-machine.ts";

test("allows coherent content transitions", () => {
  assert.equal(canTransition("DRAFT_IDEA", "ANALYZED"), true);
  assert.equal(canTransition("DRAFT_IDEA", "PUBLISHED"), false);
});

test("records audit event for valid transition", () => {
  const event = transitionContentStatus({
    previousStatus: "IN_REVIEW",
    nextStatus: "APPROVED",
    user: "roger",
    comment: "Approved",
    version: 2,
    origin: "unit-test"
  });
  assert.equal(event.previousStatus, "IN_REVIEW");
  assert.equal(event.nextStatus, "APPROVED");
});
`,
  "tests/unit/scoring.test.ts": `import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../packages/config/src/env.ts";
import { analyzePerformance } from "../../packages/analytics/src/performance.ts";
import { generateFiveIdeas, selectBestIdeas } from "../../packages/strategy/src/ideation.ts";
import metrics from "../fixtures/metrics-import.ts";

test("generates exactly five ideas and selects two or three quality ideas", () => {
  const config = loadConfig();
  const analysis = analyzePerformance(metrics, config);
  const ideas = generateFiveIdeas(analysis, "normal");
  const selected = selectBestIdeas(ideas, config);
  assert.equal(ideas.length, 5);
  assert.ok(selected.length >= 2 && selected.length <= 3);
  assert.ok(selected.every((idea) => idea.globalScore >= config.thresholds.minAverageScore));
});
`,
  "tests/unit/connectors.test.ts": `import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../packages/config/src/env.ts";
import { buildConnectorRegistry } from "../../packages/connectors/src/registry.ts";

test("uses mock connectors when integrations are disabled", async () => {
  const connectors = buildConnectorRegistry(loadConfig());
  assert.ok(connectors.length >= 20);
  const health = await connectors[0].healthCheck();
  assert.equal(health.status, "disabled");
});
`,
  "tests/unit/validation.test.ts": `import test from "node:test";
import assert from "node:assert/strict";
import { validateMetric } from "../../packages/validation/src/schemas.ts";
import metrics from "../fixtures/metrics-import.ts";

test("fixture metrics are valid", () => {
  assert.ok(metrics.every((metric) => validateMetric(metric).ok));
});
`,
  "tests/integration/mock-flow.test.ts": `import test from "node:test";
import assert from "node:assert/strict";
import { runMockContentFlow } from "../../packages/core/src/pipeline.ts";

test("full mock flow reaches report with generated content and publications", async () => {
  const report = await runMockContentFlow();
  assert.equal(report.generatedIdeas.length, 5);
  assert.ok(report.selectedIdeas.length >= 2);
  assert.equal(report.contents.length, report.approvedIdeas.length);
  assert.ok(report.publications.every((publication) => publication.status === "published"));
  assert.equal(report.metricsCollected, true);
});
`,
  "tests/integration/no-qualified-ideas.test.ts": `import test from "node:test";
import assert from "node:assert/strict";
import { runMockContentFlow } from "../../packages/core/src/pipeline.ts";

test("no_qualified_ideas scenario does not generate content", async () => {
  const report = await runMockContentFlow({ mockScenario: "no_qualified_ideas" });
  assert.equal(report.generatedIdeas.length, 5);
  assert.equal(report.selectedIdeas.length, 0);
  assert.equal(report.contents.length, 0);
});
`,
  "tests/e2e/content-lifecycle.test.ts": `import test from "node:test";
import assert from "node:assert/strict";
import { runMockContentFlow } from "../../packages/core/src/pipeline.ts";

test("E2E mock lifecycle covers analysis through report", async () => {
  const report = await runMockContentFlow();
  assert.ok(report.analysis.weightedScore > 0);
  assert.equal(report.generatedIdeas.length, 5);
  assert.ok(report.selectedIdeas.length >= 2 && report.selectedIdeas.length <= 3);
  assert.ok(report.approvedIdeas.every((idea) => idea.status === "APPROVED"));
  assert.ok(report.contents[0].article.body.includes("## Seguent pas"));
  assert.ok(report.contents[0].linkedin.text.includes("CTA:"));
  assert.ok(report.contents[0].adaptations.length >= 8);
  assert.ok(report.publications.every((publication) => publication.publicationIds.length > 0));
  assert.ok(report.auditLog.some((event) => event.nextStatus === "METRICS_COLLECTED"));
  assert.ok(report.report.summary.length > 0);
});
`,
  "tests/fixtures/metrics-import.ts": `import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { MetricRecord } from "../../packages/shared/src/domain.ts";

const metrics = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../data/fixtures/content-performance.json", import.meta.url)), "utf8")
) as MetricRecord[];

export default metrics;
`
};

function createAll() {
  ensureProjectRoot();
  for (const [path, content] of Object.entries(rootDocs)) write(path, content);
  writeJson("package.json", packageJson);

  write("packages/shared/src/domain.ts", sharedDomain);
  write("packages/config/src/env.ts", configEnv);
  write("packages/logging/src/logger.ts", logger);
  write("packages/validation/src/schemas.ts", validationSchemas);
  write("packages/core/src/state-machine.ts", stateMachine);
  write("packages/core/src/pipeline.ts", pipeline);
  write("packages/analytics/src/performance.ts", analytics);
  write("packages/strategy/src/ideation.ts", strategy);
  write("packages/content/src/generator.ts", contentGenerator);
  write("packages/publishing/src/scheduler.ts", publishing);
  write("packages/connectors/src/interface.ts", connectorInterface);
  write("packages/connectors/src/registry.ts", connectorRegistry);
  write("packages/database/prisma/schema.prisma", prismaSchema);
  write("packages/database/prisma/migrations/0001_init/migration.sql", migrationSql);
  write("packages/database/src/seed.ts", `import "../../../scripts/db-seed.ts";\n`);

  write("apps/api/src/server.ts", apiServer);
  write("apps/api/package.json", JSON.stringify({ name: "@aimetos/api", private: true, type: "module" }, null, 2) + "\n");
  write("apps/dashboard/public/index.html", dashboardHtml);
  write("apps/dashboard/public/styles.css", dashboardCss);
  write("apps/dashboard/public/app.js", dashboardJs);
  write("apps/dashboard/app/page.tsx", nextPage);
  write("apps/dashboard/next.config.mjs", `const nextConfig = {};\nexport default nextConfig;\n`);
  write("apps/dashboard/package.json", JSON.stringify({ name: "@aimetos/dashboard", private: true, type: "module" }, null, 2) + "\n");
  write("apps/worker/src/run.ts", workerRun);
  write("apps/worker/package.json", JSON.stringify({ name: "@aimetos/worker", private: true, type: "module" }, null, 2) + "\n");

  for (const [path, content] of Object.entries(scriptFiles)) write(path, content);
  for (const [path, content] of Object.entries(docs)) write(path, content);
  for (const [path, content] of Object.entries(githubFiles)) write(path, content);
  for (const [path, content] of Object.entries(dockerFiles)) write(path, content);
  for (const [path, content] of Object.entries(tests)) write(path, content);

  writeJson("data/fixtures/content-performance.json", metrics);
  writeJson("data/fixtures/leads.json", leads);
  writeJson("data/fixtures/campaigns.json", campaigns);
  writeJson("data/mocks/scenarios.json", mockScenarios);
  write("data/exports/.gitkeep", "");
  write("data/seeds/README.md", "# Seeds\n\nMock seed scripts derive data from data/fixtures.\n");
  write("data/mocks/README.md", "# Mocks\n\nScenario configuration for deterministic connector and metric behavior.\n");

  for (const [path, prompt] of prompts) {
    writeJson("packages/prompts/" + path, prompt);
  }

  for (const [path, name, trigger, action] of workflowNames) {
    writeJson("automation/n8n/workflows/" + path, workflow(name, trigger, action));
  }
  for (const [path, name, trigger, action] of subworkflows) {
    writeJson("automation/n8n/subworkflows/" + path, workflow(name, trigger, action));
  }
  write("automation/n8n/README.md", "# n8n\n\nImport workflows first, then subworkflows. All workflows use local webhooks and mock mode by default.\n");
  write("automation/cron/daily-metrics.cron", "17 6 * * * cd /app && node apps/worker/src/run.ts\n");
  write("automation/cron/weekly-ideas.cron", "30 8 * * 1 cd /app && MOCK_SCENARIO=normal node apps/worker/src/run.ts\n");
  write("automation/scripts/export-report.ps1", "node scripts/mock-scenario.ts normal\n");

  write("packages/core/package.json", JSON.stringify({ name: "@aimetos/core", private: true, type: "module" }, null, 2) + "\n");
  write("packages/analytics/package.json", JSON.stringify({ name: "@aimetos/analytics", private: true, type: "module" }, null, 2) + "\n");
  write("packages/strategy/package.json", JSON.stringify({ name: "@aimetos/strategy", private: true, type: "module" }, null, 2) + "\n");
  write("packages/content/package.json", JSON.stringify({ name: "@aimetos/content", private: true, type: "module" }, null, 2) + "\n");
  write("packages/publishing/package.json", JSON.stringify({ name: "@aimetos/publishing", private: true, type: "module" }, null, 2) + "\n");
  write("packages/connectors/package.json", JSON.stringify({ name: "@aimetos/connectors", private: true, type: "module" }, null, 2) + "\n");
  write("packages/config/package.json", JSON.stringify({ name: "@aimetos/config", private: true, type: "module" }, null, 2) + "\n");
  write("packages/logging/package.json", JSON.stringify({ name: "@aimetos/logging", private: true, type: "module" }, null, 2) + "\n");
  write("packages/validation/package.json", JSON.stringify({ name: "@aimetos/validation", private: true, type: "module" }, null, 2) + "\n");
  write("packages/shared/package.json", JSON.stringify({ name: "@aimetos/shared", private: true, type: "module" }, null, 2) + "\n");
  write("packages/database/package.json", JSON.stringify({ name: "@aimetos/database", private: true, type: "module" }, null, 2) + "\n");
  write("packages/prompts/package.json", JSON.stringify({ name: "@aimetos/prompts", private: true, type: "module" }, null, 2) + "\n");
}

createAll();
console.log("Created AImetos content system at " + projectRoot);
