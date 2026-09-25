CREATE TABLE IF NOT EXISTS "LinkedInAccount" (
  "id" TEXT PRIMARY KEY,
  "memberUrn" TEXT UNIQUE,
  "status" TEXT NOT NULL,
  "accessTokenEncrypted" TEXT,
  "refreshTokenEncrypted" TEXT,
  "accessTokenExpiresAt" TIMESTAMP(3),
  "refreshTokenExpiresAt" TIMESTAMP(3),
  "grantedScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "connectedAt" TIMESTAMP(3),
  "disconnectedAt" TIMESTAMP(3),
  "lastSyncAt" TIMESTAMP(3),
  "lastSyncStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "LinkedInOAuthState" (
  "id" TEXT PRIMARY KEY,
  "stateHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "LinkedInOAuthState_expiresAt_idx" ON "LinkedInOAuthState"("expiresAt");

CREATE TABLE IF NOT EXISTS "LinkedInPost" (
  "id" TEXT PRIMARY KEY,
  "internalContentId" TEXT UNIQUE,
  "linkedinUrn" TEXT UNIQUE,
  "linkedinUrl" TEXT,
  "activityId" TEXT,
  "urnValidationStatus" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "author" TEXT,
  "text" TEXT,
  "hook" TEXT,
  "format" TEXT,
  "editorialFamily" TEXT,
  "decisionId" TEXT,
  "experimentId" TEXT,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "LinkedInPost_publishedAt_idx" ON "LinkedInPost"("publishedAt");
CREATE INDEX IF NOT EXISTS "LinkedInPost_source_idx" ON "LinkedInPost"("source");

CREATE TABLE IF NOT EXISTS "LinkedInPostSnapshot" (
  "id" TEXT PRIMARY KEY,
  "postId" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "milestone" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "membersReached" INTEGER NOT NULL DEFAULT 0,
  "reactions" INTEGER NOT NULL DEFAULT 0,
  "comments" INTEGER NOT NULL DEFAULT 0,
  "reshares" INTEGER NOT NULL DEFAULT 0,
  "postSaves" INTEGER NOT NULL DEFAULT 0,
  "postSends" INTEGER NOT NULL DEFAULT 0,
  "followersGained" INTEGER NOT NULL DEFAULT 0,
  "profileViewsFromContent" INTEGER NOT NULL DEFAULT 0,
  "linkClicks" INTEGER NOT NULL DEFAULT 0,
  "premiumCtaClicks" INTEGER NOT NULL DEFAULT 0,
  "rawPayload" JSONB NOT NULL,
  "dataQualityNote" TEXT,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LinkedInPostSnapshot_postId_fkey" FOREIGN KEY ("postId") REFERENCES "LinkedInPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "LinkedInPostSnapshot_postId_capturedAt_idx" ON "LinkedInPostSnapshot"("postId", "capturedAt");
CREATE INDEX IF NOT EXISTS "LinkedInPostSnapshot_source_idx" ON "LinkedInPostSnapshot"("source");

CREATE TABLE IF NOT EXISTS "LinkedInProfileSnapshot" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "followersTotal" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "rawPayload" JSONB NOT NULL,
  "dataQualityNote" TEXT,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LinkedInProfileSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LinkedInAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "LinkedInProfileSnapshot_accountId_capturedAt_idx" ON "LinkedInProfileSnapshot"("accountId", "capturedAt");

CREATE TABLE IF NOT EXISTS "LinkedInSyncRun" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT,
  "status" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3),
  "callsUsed" INTEGER NOT NULL DEFAULT 0,
  "postsRead" INTEGER NOT NULL DEFAULT 0,
  "snapshotsCreated" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "durationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "LinkedInSyncRun_startedAt_idx" ON "LinkedInSyncRun"("startedAt");

CREATE TABLE IF NOT EXISTS "LinkedInApiError" (
  "id" TEXT PRIMARY KEY,
  "syncRunId" TEXT,
  "postId" TEXT,
  "code" TEXT NOT NULL,
  "httpStatus" INTEGER,
  "message" TEXT NOT NULL,
  "retryable" BOOLEAN NOT NULL DEFAULT FALSE,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB
);

CREATE INDEX IF NOT EXISTS "LinkedInApiError_occurredAt_idx" ON "LinkedInApiError"("occurredAt");
CREATE INDEX IF NOT EXISTS "LinkedInApiError_syncRunId_idx" ON "LinkedInApiError"("syncRunId");
