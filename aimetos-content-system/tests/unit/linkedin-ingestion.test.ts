import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MemoryLinkedInStore } from "../../packages/database/src/linkedin-store.ts";
import { validateLinkedInApiVersion } from "../../packages/config/src/env.ts";
import { buildEditorialState } from "../../packages/core/src/editorial-state.ts";
import type { RealContentRecord } from "../../packages/shared/src/domain.ts";
import { encryptSecret } from "../../packages/linkedin/src/crypto.ts";
import { LinkedInApiError, LinkedInClient, type LinkedInPostMetric } from "../../packages/linkedin/src/client.ts";
import { LinkedInOAuthService } from "../../packages/linkedin/src/oauth.ts";
import { LinkedInSyncService } from "../../packages/linkedin/src/sync.ts";
import { encodeRestliEntity, parseLinkedInPostUrl } from "../../packages/linkedin/src/url.ts";

type Fixture = { urn: string; metrics: Record<LinkedInPostMetric, number> };
const fixturePath = (name: string) => fileURLToPath(new URL(`../../data/fixtures/linkedin-api/${name}.json`, import.meta.url));
const fixture = (name: string) => JSON.parse(readFileSync(fixturePath(name), "utf8")) as Fixture;
const encryptionKey = Buffer.alloc(32, 7).toString("base64");

function metricFetch(metrics: Fixture["metrics"]) {
  return async (input: string | URL) => {
    const url = new URL(String(input));
    const metric = url.searchParams.get("queryType") as LinkedInPostMetric;
    return new Response(JSON.stringify({ elements: [{ count: metrics[metric] || 0, metricType: metric }] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
}

async function setup(fixtureName: string, now = "2026-09-24T10:00:00.000Z") {
  const data = fixture(fixtureName);
  const store = new MemoryLinkedInStore();
  await store.upsertAccount({
    status: "connected",
    accessTokenEncrypted: encryptSecret("test-token-never-returned", encryptionKey),
    accessTokenExpiresAt: "2026-12-01T00:00:00.000Z",
    grantedScopes: ["r_member_postAnalytics", "r_member_profileAnalytics"]
  });
  const post = await store.upsertPost({
    internalContentId: fixtureName === "approvals" ? "LI-17" : "LI-16",
    linkedinUrn: data.urn,
    linkedinUrl: `https://www.linkedin.com/feed/update/${data.urn}/`,
    urnValidationStatus: "pending_api_validation",
    publishedAt: "2026-09-15T06:40:00.000Z",
    source: "manual_export"
  });
  const client = new LinkedInClient({ apiVersion: "202609", fetch: metricFetch(data.metrics), sleep: async () => {} });
  const sync = new LinkedInSyncService({ store, client, encryptionKey, now: () => new Date(now) });
  return { data, store, post, client, sync };
}

test("official PM fixture normalizes all required post metrics", async () => {
  const { store, post, sync } = await setup("project-management");
  const result = await sync.syncLinkedInPost(post.id, undefined, "7d");
  const [snapshot] = await store.listPostSnapshots(post.id);

  assert.equal(result.created, true);
  assert.equal(snapshot.impressions, 267);
  assert.equal(snapshot.membersReached, 163);
  assert.equal(snapshot.reactions, 3);
  assert.equal(snapshot.comments, 3);
  assert.equal(snapshot.postSaves, 1);
  assert.equal(snapshot.profileViewsFromContent, 6);
  assert.equal(snapshot.source, "linkedin_api");
  assert.ok(snapshot.rawPayload);
  assert.equal((await store.getPost(post.id))?.urnValidationStatus, "validated");
});

test("identical synchronization is idempotent and a higher snapshot never overwrites history", async () => {
  const { data, store, post, sync } = await setup("project-management");
  await sync.syncLinkedInPost(post.id, undefined, "7d");
  const duplicate = await sync.syncLinkedInPost(post.id, undefined, "7d");
  assert.equal(duplicate.created, false);
  assert.equal((await store.listPostSnapshots(post.id)).length, 1);

  const higherClient = new LinkedInClient({
    apiVersion: "202609",
    fetch: metricFetch({ ...data.metrics, IMPRESSION: 301 }),
    sleep: async () => {}
  });
  const higherSync = new LinkedInSyncService({ store, client: higherClient, encryptionKey, now: () => new Date("2026-09-25T10:00:00.000Z") });
  await higherSync.syncLinkedInPost(post.id, undefined, "7d");
  const snapshots = await store.listPostSnapshots(post.id);
  assert.deepEqual(snapshots.map((item) => item.impressions), [267, 301]);
});

test("an afternoon approvals datapoint remains insufficient evidence about timing", async () => {
  const data = fixture("approvals");
  const record: RealContentRecord = {
    id: "LI-17", platform: "linkedin", title: "Aprovacions", topic: "Aprovacions",
    editorialAngle: "cas real", editorialFamily: "human_criterion_governance", format: "image_post",
    publishedAt: "2026-09-22T15:26:00.000Z", published_weekday: "tuesday", published_hour: 17,
    published_minute: 26, time_slot: "evening", status: "published", metricsStatus: "available",
    sourceType: "linkedin_api", targetCustomer: "PIMEs", funnelStage: "MOFU", snapshots: [{
      capturedAt: "2026-09-24T10:00:00.000Z", period: "72h", impressions: data.metrics.IMPRESSION,
      reach: data.metrics.MEMBERS_REACHED, reactions: data.metrics.REACTION,
      comments: data.metrics.COMMENT, profileViews: data.metrics.PROFILE_VIEW_FROM_CONTENT,
      sourceType: "linkedin_api"
    }]
  };
  const state = buildEditorialState({ records: [record], now: new Date("2026-09-24T12:00:00.000Z") });
  assert.equal(state.timing_confidence, "insufficient_data");
  assert.doesNotMatch(state.timing_reason.toLowerCase(), /tarda.*dolent|afternoon bad/);
});

test("expired token becomes a warning without deleting existing snapshots", async () => {
  const { store, post, client } = await setup("project-management");
  await store.addPostSnapshot({
    postId: post.id, capturedAt: "2026-09-23T10:00:00.000Z", milestone: "72h", source: "linkedin_api",
    impressions: 100, membersReached: 50, reactions: 1, comments: 0, reshares: 0, postSaves: 0,
    postSends: 0, followersGained: 0, profileViewsFromContent: 1, linkClicks: 0, premiumCtaClicks: 0,
    rawPayload: {}, idempotencyKey: "existing"
  });
  const account = await store.getAccount();
  await store.upsertAccount({ ...account!, status: "connected", accessTokenExpiresAt: "2026-09-01T00:00:00.000Z" });
  const sync = new LinkedInSyncService({ store, client, encryptionKey, now: () => new Date("2026-09-24T10:00:00.000Z") });
  await assert.rejects(() => sync.syncLinkedInPost(post.id), (error: unknown) => error instanceof LinkedInApiError && error.code === "TOKEN_EXPIRED");
  assert.equal((await store.getAccount())?.status, "warning");
  assert.equal((await store.listPostSnapshots(post.id)).length, 1);
});

test("unavailable API retries in a controlled way and creates no duplicate data", async () => {
  const { store, post } = await setup("project-management");
  let attempts = 0;
  const client = new LinkedInClient({
    apiVersion: "202609",
    fetch: async () => { attempts += 1; throw new Error("offline"); },
    maxRetries: 2,
    sleep: async () => {}
  });
  const sync = new LinkedInSyncService({ store, client, encryptionKey, now: () => new Date("2026-09-24T10:00:00.000Z") });
  await assert.rejects(() => sync.syncLinkedInPost(post.id), /unavailable/);
  assert.equal(attempts, 3);
  assert.equal((await store.listPostSnapshots(post.id)).length, 0);
});

test("URL parsing never invents an activity-to-share relation", () => {
  const activity = parseLinkedInPostUrl("https://www.linkedin.com/posts/name-topic-activity-7439578127900573697-sIWZ");
  assert.equal(activity.activityId, "7439578127900573697");
  assert.equal(activity.candidateUrn, undefined);
  assert.equal(activity.validationStatus, "missing");
  const share = parseLinkedInPostUrl("https://www.linkedin.com/posts/name-share-7439578127900573697-abcd");
  assert.equal(share.candidateUrn, "urn:li:share:7439578127900573697");
  assert.equal(encodeRestliEntity(share.candidateUrn!), "(share:urn%3Ali%3Ashare%3A7439578127900573697)");
});

test("official Rest.li request preserves the documented entity wrapper", async () => {
  let requestedUrl = "";
  const client = new LinkedInClient({
    apiVersion: "202609",
    fetch: async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ elements: [{ count: 1, metricType: "IMPRESSION" }] }), { status: 200 });
    }
  });
  await client.getPostMetric("secret-test-token", "urn:li:share:7439578127900573697", "IMPRESSION");
  assert.match(requestedUrl, /entity=\(share:urn%3Ali%3Ashare%3A7439578127900573697\)/);
  assert.doesNotMatch(requestedUrl, /secret-test-token/);
});

test("OAuth uses one-time state and stores encrypted tokens with only granted scopes", async () => {
  const store = new MemoryLinkedInStore();
  const oauth = new LinkedInOAuthService({
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUri: "https://dashboard.example/api/linkedin/oauth/callback",
    tokenEncryptionKey: encryptionKey
  }, store, async () => new Response(JSON.stringify({
    access_token: "oauth-access-token",
    expires_in: 3600,
    scope: "r_member_postAnalytics"
  }), { status: 200 }));
  const authorizationUrl = new URL(await oauth.createAuthorizationUrl());
  const state = authorizationUrl.searchParams.get("state")!;
  assert.equal(authorizationUrl.searchParams.get("scope"), "r_member_postAnalytics r_member_profileAnalytics");
  await oauth.completeAuthorization("authorization-code", state);
  const account = await store.getAccount();
  assert.equal(account?.status, "connected");
  assert.notEqual(account?.accessTokenEncrypted, "oauth-access-token");
  assert.deepEqual(account?.grantedScopes, ["r_member_postAnalytics"]);
  await assert.rejects(() => oauth.completeAuthorization("authorization-code", state), /invalid or expired/);
});

test("LinkedIn API version check rejects missing, malformed and pre-analytics versions", () => {
  assert.equal(validateLinkedInApiVersion(undefined).reason, "missing");
  assert.equal(validateLinkedInApiVersion("202613").reason, "invalid_format");
  const now = new Date("2026-09-24T00:00:00.000Z");
  assert.equal(validateLinkedInApiVersion("202504", now).reason, "older_than_minimum");
  assert.equal(validateLinkedInApiVersion("202509", now).reason, "obsolete");
  assert.deepEqual(validateLinkedInApiVersion("202609", now), { valid: true, reason: "ok" });
});
