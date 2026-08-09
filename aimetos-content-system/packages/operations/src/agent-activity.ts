export const agentEventStatuses = ["started", "succeeded", "failed", "warning", "waiting"] as const;
export const agentEventSeverities = ["info", "important", "critical"] as const;

export type AgentEvent = {
  id: string;
  agentId: string;
  agentName: string;
  workflowId: string;
  workflowName: string;
  executionId: string;
  correlationId: string;
  status: (typeof agentEventStatuses)[number];
  severity: (typeof agentEventSeverities)[number];
  title: string;
  summary: string;
  occurredAt: string;
  durationMs?: number;
  retryCount: number;
  requiresAttention: boolean;
  actionUrl?: string;
  metadata: Record<string, unknown>;
};

export type AgentEventInput = Omit<AgentEvent, "id"> & { id?: string };

export function validateAgentEvent(input: Partial<AgentEventInput>): string[] {
  const issues: string[] = [];
  for (const field of ["agentId", "agentName", "workflowId", "workflowName", "executionId", "correlationId", "title", "summary"] as const) {
    if (!input[field] || String(input[field]).trim().length === 0) issues.push(field);
  }
  if (!agentEventStatuses.includes(input.status as AgentEvent["status"])) issues.push("status");
  if (!agentEventSeverities.includes(input.severity as AgentEvent["severity"])) issues.push("severity");
  if (!input.occurredAt || Number.isNaN(Date.parse(input.occurredAt))) issues.push("occurredAt");
  if (input.durationMs !== undefined && (!Number.isFinite(input.durationMs) || input.durationMs < 0)) issues.push("durationMs");
  if (!Number.isInteger(input.retryCount) || Number(input.retryCount) < 0) issues.push("retryCount");
  if (typeof input.requiresAttention !== "boolean") issues.push("requiresAttention");
  if (input.actionUrl && !/^https?:\/\//.test(input.actionUrl)) issues.push("actionUrl");
  return [...new Set(issues)];
}

export function normalizeAgentEvent(input: AgentEventInput): AgentEvent {
  return {
    ...input,
    id: input.id || `evt_${crypto.randomUUID()}`,
    agentId: input.agentId.trim(),
    agentName: input.agentName.trim(),
    workflowId: input.workflowId.trim(),
    workflowName: input.workflowName.trim(),
    executionId: input.executionId.trim(),
    correlationId: input.correlationId.trim(),
    title: input.title.trim(),
    summary: input.summary.trim(),
    metadata: input.metadata || {}
  };
}

export function buildAgentActivity(events: AgentEvent[]) {
  const ordered = [...events].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const latestByExecution = new Map<string, AgentEvent>();
  for (const event of ordered) if (!latestByExecution.has(event.executionId)) latestByExecution.set(event.executionId, event);
  const executions = [...latestByExecution.values()];
  const agents = new Set(events.map((event) => event.agentId));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      agents: agents.size,
      executions: executions.length,
      succeeded: executions.filter((event) => event.status === "succeeded").length,
      running: executions.filter((event) => event.status === "started" || event.status === "waiting").length,
      failed: executions.filter((event) => event.status === "failed").length,
      attention: executions.filter((event) => event.requiresAttention).length
    },
    important: ordered.filter((event) => event.severity !== "info" || event.requiresAttention).slice(0, 6),
    recent: ordered.slice(0, 30)
  };
}
