import { createHash } from "node:crypto";
import type {
  LinkedInPostRecord,
  LinkedInPostSnapshotRecord,
  LinkedInStore,
  LinkedInSyncRunRecord
} from "../../database/src/linkedin-store.ts";
import { decryptSecret } from "./crypto.ts";
import { LinkedInApiError, LinkedInClient, type LinkedInPostMetric } from "./client.ts";

export type NormalizedPostMetrics = Omit<LinkedInPostSnapshotRecord, "id" | "postId" | "capturedAt" | "milestone" | "source" | "rawPayload" | "dataQualityNote" | "idempotencyKey" | "createdAt">;

const METRIC_FIELDS: Record<LinkedInPostMetric, keyof NormalizedPostMetrics> = {
  IMPRESSION: "impressions",
  MEMBERS_REACHED: "membersReached",
  RESHARE: "reshares",
  REACTION: "reactions",
  COMMENT: "comments",
  POST_SAVE: "postSaves",
  POST_SEND: "postSends",
  LINK_CLICKS: "linkClicks",
  PREMIUM_CTA_CLICKS: "premiumCtaClicks",
  FOLLOWER_GAINED_FROM_CONTENT: "followersGained",
  PROFILE_VIEW_FROM_CONTENT: "profileViewsFromContent"
};

export function normalizePostMetrics(metrics: Partial<Record<LinkedInPostMetric, number>>): NormalizedPostMetrics {
  const output: NormalizedPostMetrics = {
    impressions: 0, membersReached: 0, reactions: 0, comments: 0, reshares: 0,
    postSaves: 0, postSends: 0, followersGained: 0, profileViewsFromContent: 0,
    linkClicks: 0, premiumCtaClicks: 0
  };
  for (const [metric, field] of Object.entries(METRIC_FIELDS) as Array<[LinkedInPostMetric, keyof NormalizedPostMetrics]>) {
    output[field] = Math.max(0, Number(metrics[metric] || 0));
  }
  return output;
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value, Object.keys(value as object).sort())).digest("hex");
}

export function milestoneFor(post: LinkedInPostRecord, snapshots: LinkedInPostSnapshotRecord[], now: Date): LinkedInPostSnapshotRecord["milestone"] | undefined {
  if (!post.publishedAt) return "latest";
  const ageHours = (now.getTime() - Date.parse(post.publishedAt)) / 3_600_000;
  if (!Number.isFinite(ageHours) || ageHours < 0) return undefined;
  const completed = new Set(snapshots.map((snapshot) => snapshot.milestone));
  if (ageHours >= 168) return completed.has("7d") ? undefined : "7d";
  if (ageHours >= 72) return completed.has("72h") ? undefined : "72h";
  if (ageHours >= 24) return completed.has("24h") ? undefined : "24h";
  return undefined;
}

export type LinkedInSyncOptions = {
  store: LinkedInStore;
  client: LinkedInClient;
  encryptionKey: string;
  maxCallsPerDay?: number;
  now?: () => Date;
};

export class LinkedInSyncService {
  private readonly maxCallsPerDay: number;
  private readonly now: () => Date;
  private readonly options: LinkedInSyncOptions;
  constructor(options: LinkedInSyncOptions) {
    this.options = options;
    this.maxCallsPerDay = options.maxCallsPerDay ?? 90;
    this.now = options.now || (() => new Date());
  }

  private async accessToken() {
    const account = await this.options.store.getAccount();
    if (!account?.accessTokenEncrypted || account.status === "disconnected") throw new LinkedInApiError("LinkedIn account is not connected", "NOT_CONNECTED");
    if (account.accessTokenExpiresAt && Date.parse(account.accessTokenExpiresAt) <= this.now().getTime()) {
      await this.options.store.upsertAccount({ ...account, status: "warning", lastSyncStatus: "token_expired" });
      throw new LinkedInApiError("LinkedIn token expired; reconnect the account", "TOKEN_EXPIRED", 401);
    }
    return { account, token: decryptSecret(account.accessTokenEncrypted, this.options.encryptionKey) };
  }

  private async remainingBudget() {
    const now = this.now();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return Math.max(0, this.maxCallsPerDay - await this.options.store.countCallsSince(start.toISOString()));
  }

  async syncLinkedInPost(postId: string, run?: LinkedInSyncRunRecord, forcedMilestone?: LinkedInPostSnapshotRecord["milestone"]) {
    const { account, token } = await this.accessToken();
    const post = await this.options.store.getPost(postId);
    if (!post) throw new Error("LinkedIn post is not registered");
    if (!post.linkedinUrn) throw new LinkedInApiError("Post URL is registered but its official URN is still missing", "URN_REQUIRED");
    if (await this.remainingBudget() < 11) throw new LinkedInApiError("Daily LinkedIn call budget does not allow another full post snapshot", "CALL_BUDGET_EXHAUSTED", 429);
    const beforeCalls = this.options.client.callsUsed;
    const response = await this.options.client.getAllPostMetrics(token, post.linkedinUrn);
    const normalized = normalizePostMetrics(response.metrics);
    const capturedAt = this.now().toISOString();
    const existing = await this.options.store.listPostSnapshots(post.id);
    const milestone = forcedMilestone || milestoneFor(post, existing, this.now()) || "latest";
    const idempotencyKey = stableHash({ postId: post.id, milestone, ...normalized });
    const result = await this.options.store.addPostSnapshot({
      postId: post.id,
      capturedAt,
      milestone,
      source: "linkedin_api",
      ...normalized,
      rawPayload: response.raw,
      dataQualityNote: "LinkedIn analytics are best-effort and may differ from the LinkedIn UI.",
      idempotencyKey
    });
    if (post.urnValidationStatus !== "validated") {
      await this.options.store.upsertPost({ ...post, source: post.source, urnValidationStatus: "validated" });
    }
    if (!run) {
      await this.options.store.upsertAccount({ ...account, status: "connected", lastSyncAt: capturedAt, lastSyncStatus: "ok" });
    }
    return { ...result, callsUsed: this.options.client.callsUsed - beforeCalls };
  }

  async syncLinkedIn(trigger: LinkedInSyncRunRecord["trigger"] = "manual") {
    const started = this.now();
    const callsBeforeRun = this.options.client.callsUsed;
    const account = await this.options.store.getAccount();
    const run = await this.options.store.startSyncRun(trigger, account?.id);
    let callsUsed = 0;
    let postsRead = 0;
    let snapshotsCreated = 0;
    let errorCount = 0;
    let status: LinkedInSyncRunRecord["status"] = "ok";
    try {
      const posts = await this.options.store.listPosts();
      for (const post of posts) {
        const snapshots = await this.options.store.listPostSnapshots(post.id);
        const due = milestoneFor(post, snapshots, this.now());
        if (!post.linkedinUrn || !due) continue;
        if ((await this.remainingBudget()) - (this.options.client.callsUsed - callsBeforeRun) < 11) { status = "warning"; break; }
        try {
          const result = await this.syncLinkedInPost(post.id, run, due);
          callsUsed += result.callsUsed;
          postsRead += 1;
          if (result.created) snapshotsCreated += 1;
        } catch (error) {
          errorCount += 1;
          status = "warning";
          await this.recordError(error, run.id, post.id);
          if (error instanceof LinkedInApiError && ["TOKEN_EXPIRED", "APPROVAL_REQUIRED"].includes(error.code)) break;
        }
      }

      if ((await this.remainingBudget()) - (this.options.client.callsUsed - callsBeforeRun) >= 1) {
        try {
          const credentials = await this.accessToken();
          const beforeCalls = this.options.client.callsUsed;
          const followers = await this.options.client.getFollowersCount(credentials.token);
          callsUsed += this.options.client.callsUsed - beforeCalls;
          const capturedAt = this.now().toISOString();
          const idempotencyKey = stableHash({ accountId: credentials.account.id, day: capturedAt.slice(0, 10), followersTotal: followers.followersTotal });
          await this.options.store.addProfileSnapshot({
            accountId: credentials.account.id,
            capturedAt,
            followersTotal: followers.followersTotal,
            source: "linkedin_api",
            rawPayload: followers.raw,
            dataQualityNote: "Official LinkedIn member followers count.",
            idempotencyKey
          });
        } catch (error) {
          errorCount += 1;
          status = "warning";
          await this.recordError(error, run.id);
        }
      }
    } catch (error) {
      errorCount += 1;
      status = "error";
      await this.recordError(error, run.id);
    }
    const finished = this.now();
    callsUsed = this.options.client.callsUsed - callsBeforeRun;
    const completed = await this.options.store.finishSyncRun(run.id, {
      status, finishedAt: finished.toISOString(), callsUsed, postsRead, snapshotsCreated, errorCount,
      durationMs: finished.getTime() - started.getTime()
    });
    const current = await this.options.store.getAccount();
    if (current) await this.options.store.upsertAccount({ ...current, status: status === "ok" ? "connected" : "warning", lastSyncAt: finished.toISOString(), lastSyncStatus: status });
    return completed;
  }

  private async recordError(error: unknown, syncRunId?: string, postId?: string) {
    const apiError = error instanceof LinkedInApiError ? error : new LinkedInApiError("Unexpected LinkedIn synchronization error", "UNEXPECTED_ERROR");
    await this.options.store.recordApiError({
      syncRunId, postId, code: apiError.code, httpStatus: apiError.status,
      message: apiError.message, retryable: apiError.retryable
    });
    const account = await this.options.store.getAccount();
    if (account && ["TOKEN_EXPIRED", "APPROVAL_REQUIRED"].includes(apiError.code)) {
      await this.options.store.upsertAccount({
        ...account,
        status: apiError.code === "APPROVAL_REQUIRED" ? "awaiting_approval" : "warning",
        lastSyncStatus: apiError.code.toLowerCase()
      });
    }
  }
}
