import type { ConnectorKind, ConnectorResult } from "../../shared/src/domain.ts";

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
