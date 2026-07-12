import type { ContentIdea, ContentStatus, MetricRecord } from "../../shared/src/domain.ts";
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
