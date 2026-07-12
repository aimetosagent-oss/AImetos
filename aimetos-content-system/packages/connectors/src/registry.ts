import type { MockScenario } from "../../shared/src/domain.ts";
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
