import { createHash } from "node:crypto";
import type { LinkedInStore } from "../../database/src/linkedin-store.ts";
import type { DataSourceType, MetricSnapshot, RealContentRecord, SnapshotPeriod } from "../../shared/src/domain.ts";
import { parseLinkedInPostUrl } from "./url.ts";

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function milestone(period: SnapshotPeriod): "24h" | "72h" | "7d" | "latest" {
  if (period === "24h" || period === "72h" || period === "7d") return period;
  return "latest";
}

function publicationDate(record: RealContentRecord) {
  return record.publishedAtExport || record.publishedAt || record.publishedAtManual;
}

export async function backfillLinkedInHistory(
  store: LinkedInStore,
  records: RealContentRecord[],
  knownUrls: Record<string, string> = {}
) {
  let postsCreated = 0;
  let snapshotsCreated = 0;
  for (const record of records.filter((item) => item.platform === "linkedin")) {
    const url = record.url || knownUrls[record.id];
    const parsed = url ? parseLinkedInPostUrl(url) : undefined;
    const existing = await store.getPost(record.id);
    const post = await store.upsertPost({
      id: existing?.id || `linkedin_${record.id.toLowerCase()}`,
      internalContentId: record.id,
      linkedinUrl: parsed?.normalizedUrl,
      linkedinUrn: existing?.linkedinUrn || parsed?.candidateUrn,
      activityId: parsed?.activityId,
      urnValidationStatus: existing?.urnValidationStatus || parsed?.validationStatus || "missing",
      publishedAt: publicationDate(record),
      author: "Roger Arnau",
      text: record.hook,
      hook: record.hook,
      format: record.format,
      editorialFamily: record.editorialFamily,
      source: "manual_export"
    });
    if (!existing) postsCreated += 1;
    for (const snapshot of record.snapshots) {
      const normalized = {
        impressions: snapshot.impressions || snapshot.views || 0,
        membersReached: snapshot.reach || 0,
        reactions: snapshot.reactions || 0,
        comments: snapshot.comments || 0,
        reshares: snapshot.shares || 0,
        postSaves: snapshot.saves || 0,
        postSends: snapshot.sends || 0,
        followersGained: 0,
        profileViewsFromContent: snapshot.profileViews || 0,
        linkClicks: 0,
        premiumCtaClicks: 0
      };
      const result = await store.addPostSnapshot({
        postId: post.id,
        capturedAt: snapshot.capturedAt || publicationDate(record) || new Date(0).toISOString(),
        milestone: milestone(snapshot.period),
        source: "manual_export",
        ...normalized,
        rawPayload: { importedFrom: snapshot.sourceType, snapshot },
        dataQualityNote: snapshot.notes || "Historical manual/exported data retained without alteration.",
        idempotencyKey: hash({ source: "manual_export", postId: post.id, capturedAt: snapshot.capturedAt, period: snapshot.period, normalized })
      });
      if (result.created) snapshotsCreated += 1;
    }
  }
  return { postsCreated, snapshotsCreated };
}

function toDomainSource(source: "manual_export" | "linkedin_api"): DataSourceType {
  return source;
}

export async function mergeLinkedInApiData(store: LinkedInStore, baseRecords: RealContentRecord[]): Promise<RealContentRecord[]> {
  const records = structuredClone(baseRecords);
  const posts = await store.listPosts();
  const account = await store.getAccount();
  const profileSnapshots = account ? await store.listProfileSnapshots(account.id) : [];
  const latestFollowers = profileSnapshots.at(-1)?.followersTotal;

  for (const post of posts) {
    const apiSnapshots = (await store.listPostSnapshots(post.id)).filter((snapshot) => snapshot.source === "linkedin_api");
    if (apiSnapshots.length === 0) continue;
    let record = records.find((item) => item.id === post.internalContentId);
    if (!record) {
      record = {
        id: post.internalContentId || post.id,
        platform: "linkedin",
        title: post.hook || post.text || `Publicació LinkedIn ${post.publishedAt?.slice(0, 10) || "registrada"}`,
        topic: "Publicació LinkedIn registrada",
        editorialAngle: "Pendent de classificació editorial",
        editorialFamily: (post.editorialFamily as RealContentRecord["editorialFamily"]) || "technical_robustness",
        hook: post.hook || post.text,
        format: post.format || "image_post",
        publishedAt: post.publishedAt,
        url: post.linkedinUrl,
        metricsStatus: "available",
        status: "published",
        sourceType: "linkedin_api",
        targetCustomer: "PIMEs i responsables d'operacions",
        funnelStage: "MOFU",
        snapshots: []
      };
      records.push(record);
    }
    const converted: MetricSnapshot[] = apiSnapshots.map((snapshot, index) => ({
      capturedAt: snapshot.capturedAt,
      period: snapshot.milestone,
      impressions: snapshot.impressions,
      views: snapshot.impressions,
      reach: snapshot.membersReached,
      reactions: snapshot.reactions,
      comments: snapshot.comments,
      shares: snapshot.reshares,
      saves: snapshot.postSaves,
      sends: snapshot.postSends,
      profileViews: snapshot.profileViewsFromContent,
      followers: index === apiSnapshots.length - 1 ? latestFollowers : undefined,
      qualifiedLeads: 0,
      meetings: 0,
      sourceType: toDomainSource(snapshot.source),
      valid: true,
      notes: snapshot.dataQualityNote
    }));
    record.snapshots.push(...converted);
    record.snapshots.sort((a, b) => String(a.capturedAt || "").localeCompare(String(b.capturedAt || "")));
    record.metricsStatus = "available";
  }
  return records;
}
