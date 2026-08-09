import test from "node:test";
import assert from "node:assert/strict";
import { buildAgentActivity, normalizeAgentEvent, validateAgentEvent } from "../../packages/operations/src/agent-activity.ts";

const base = {
  agentId: "agent-1",
  agentName: "Agent 1",
  workflowId: "workflow-1",
  workflowName: "Workflow 1",
  executionId: "execution-1",
  correlationId: "correlation-1",
  status: "succeeded" as const,
  severity: "info" as const,
  title: "Fet",
  summary: "Execució correcta",
  occurredAt: "2026-08-09T08:00:00Z",
  durationMs: 100,
  retryCount: 0,
  requiresAttention: false,
  metadata: {}
};

test("agent activity uses the latest event as execution state", () => {
  const activity = buildAgentActivity([
    normalizeAgentEvent({ ...base, id: "one", status: "started", occurredAt: "2026-08-09T07:59:00Z" }),
    normalizeAgentEvent({ ...base, id: "two" }),
    normalizeAgentEvent({ ...base, id: "three", executionId: "execution-2", status: "failed", severity: "critical", requiresAttention: true })
  ]);

  assert.deepEqual(activity.summary, { agents: 1, executions: 2, succeeded: 1, running: 0, failed: 1, attention: 1 });
  assert.equal(activity.important[0]?.id, "three");
});

test("agent event validation rejects unsafe or incomplete payloads", () => {
  assert.deepEqual(validateAgentEvent({ ...base, actionUrl: "javascript:alert(1)", retryCount: -1 }), ["retryCount", "actionUrl"]);
});
