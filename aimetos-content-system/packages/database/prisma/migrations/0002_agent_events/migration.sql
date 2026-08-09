CREATE TABLE "AgentEvent" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "agentName" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "workflowName" TEXT NOT NULL,
  "executionId" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "durationMs" INTEGER,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "requiresAttention" BOOLEAN NOT NULL DEFAULT false,
  "actionUrl" TEXT,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentEvent_occurredAt_idx" ON "AgentEvent"("occurredAt");
CREATE INDEX "AgentEvent_agentId_occurredAt_idx" ON "AgentEvent"("agentId", "occurredAt");
CREATE INDEX "AgentEvent_executionId_occurredAt_idx" ON "AgentEvent"("executionId", "occurredAt");
CREATE INDEX "AgentEvent_requiresAttention_occurredAt_idx" ON "AgentEvent"("requiresAttention", "occurredAt");
