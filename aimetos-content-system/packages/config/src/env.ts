import type { AppMode, MockScenario, Language } from "../../shared/src/domain.ts";

export type RuntimeConfig = {
  appName: string;
  appMode: AppMode;
  mockScenario: MockScenario;
  port: number;
  logLevel: "debug" | "info" | "warn" | "error";
  defaultLanguage: Language;
  uiLanguage: Language;
  contentLanguage: Language;
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
    uiLanguage: pick("UI_LANGUAGE", languages, "ca"),
    contentLanguage: pick("CONTENT_LANGUAGE", languages, "es"),
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
