import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Pool } from "pg";

export type LinkedInConnectionStatus = "disconnected" | "connected" | "warning" | "awaiting_approval";
export type LinkedInDataSource = "manual_export" | "linkedin_api";
export type LinkedInUrnValidationStatus = "missing" | "pending_api_validation" | "validated" | "invalid";

export type LinkedInAccountRecord = {
  id: string;
  memberUrn?: string;
  status: LinkedInConnectionStatus;
  accessTokenEncrypted?: string;
  refreshTokenEncrypted?: string;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
  grantedScopes: string[];
  connectedAt?: string;
  disconnectedAt?: string;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  createdAt: string;
  updatedAt: string;
};

export type LinkedInPostRecord = {
  id: string;
  internalContentId?: string;
  linkedinUrn?: string;
  linkedinUrl?: string;
  activityId?: string;
  urnValidationStatus: LinkedInUrnValidationStatus;
  publishedAt?: string;
  author?: string;
  text?: string;
  hook?: string;
  format?: string;
  editorialFamily?: string;
  decisionId?: string;
  experimentId?: string;
  source: LinkedInDataSource;
  createdAt: string;
  updatedAt: string;
};

export type LinkedInPostSnapshotRecord = {
  id: string;
  postId: string;
  capturedAt: string;
  milestone: "24h" | "72h" | "7d" | "latest";
  source: LinkedInDataSource;
  impressions: number;
  membersReached: number;
  reactions: number;
  comments: number;
  reshares: number;
  postSaves: number;
  postSends: number;
  followersGained: number;
  profileViewsFromContent: number;
  linkClicks: number;
  premiumCtaClicks: number;
  rawPayload: unknown;
  dataQualityNote?: string;
  idempotencyKey: string;
  createdAt: string;
};

export type LinkedInProfileSnapshotRecord = {
  id: string;
  accountId: string;
  capturedAt: string;
  followersTotal: number;
  source: LinkedInDataSource;
  rawPayload: unknown;
  dataQualityNote?: string;
  idempotencyKey: string;
  createdAt: string;
};

export type LinkedInSyncRunRecord = {
  id: string;
  accountId?: string;
  status: "running" | "ok" | "warning" | "error";
  trigger: "manual" | "scheduler" | "fixture";
  startedAt: string;
  finishedAt?: string;
  callsUsed: number;
  postsRead: number;
  snapshotsCreated: number;
  errorCount: number;
  durationMs?: number;
  createdAt: string;
};

export type LinkedInApiErrorRecord = {
  id: string;
  syncRunId?: string;
  postId?: string;
  code: string;
  httpStatus?: number;
  message: string;
  retryable: boolean;
  occurredAt: string;
  metadata?: Record<string, unknown>;
};

export type LinkedInStoreState = {
  accounts: LinkedInAccountRecord[];
  oauthStates: Array<{ id: string; stateHash: string; expiresAt: string; consumedAt?: string; createdAt: string }>;
  posts: LinkedInPostRecord[];
  postSnapshots: LinkedInPostSnapshotRecord[];
  profileSnapshots: LinkedInProfileSnapshotRecord[];
  syncRuns: LinkedInSyncRunRecord[];
  apiErrors: LinkedInApiErrorRecord[];
};

export interface LinkedInStore {
  readonly backend: "memory" | "json" | "postgres";
  getAccount(): Promise<LinkedInAccountRecord | undefined>;
  upsertAccount(input: Partial<LinkedInAccountRecord> & Pick<LinkedInAccountRecord, "status">): Promise<LinkedInAccountRecord>;
  disconnectAccount(): Promise<void>;
  createOAuthState(stateHash: string, expiresAt: string): Promise<void>;
  consumeOAuthState(stateHash: string, now?: string): Promise<boolean>;
  upsertPost(input: Partial<LinkedInPostRecord> & Pick<LinkedInPostRecord, "source" | "urnValidationStatus">): Promise<LinkedInPostRecord>;
  getPost(id: string): Promise<LinkedInPostRecord | undefined>;
  listPosts(): Promise<LinkedInPostRecord[]>;
  addPostSnapshot(input: Omit<LinkedInPostSnapshotRecord, "id" | "createdAt">): Promise<{ record: LinkedInPostSnapshotRecord; created: boolean }>;
  listPostSnapshots(postId?: string): Promise<LinkedInPostSnapshotRecord[]>;
  addProfileSnapshot(input: Omit<LinkedInProfileSnapshotRecord, "id" | "createdAt">): Promise<{ record: LinkedInProfileSnapshotRecord; created: boolean }>;
  listProfileSnapshots(accountId?: string): Promise<LinkedInProfileSnapshotRecord[]>;
  startSyncRun(trigger: LinkedInSyncRunRecord["trigger"], accountId?: string): Promise<LinkedInSyncRunRecord>;
  finishSyncRun(id: string, update: Partial<LinkedInSyncRunRecord>): Promise<LinkedInSyncRunRecord>;
  getLastSyncRun(): Promise<LinkedInSyncRunRecord | undefined>;
  countCallsSince(since: string): Promise<number>;
  recordApiError(input: Omit<LinkedInApiErrorRecord, "id" | "occurredAt">): Promise<LinkedInApiErrorRecord>;
  close?(): Promise<void>;
}

function emptyState(): LinkedInStoreState {
  return { accounts: [], oauthStates: [], posts: [], postSnapshots: [], profileSnapshots: [], syncRuns: [], apiErrors: [] };
}

export class MemoryLinkedInStore implements LinkedInStore {
  readonly backend: "memory" | "json" = "memory";
  protected state: LinkedInStoreState;

  constructor(initial: Partial<LinkedInStoreState> = {}) {
    this.state = { ...emptyState(), ...structuredClone(initial) };
  }

  protected async changed(): Promise<void> {}

  async getAccount() { return this.state.accounts[0] && structuredClone(this.state.accounts[0]); }

  async upsertAccount(input: Partial<LinkedInAccountRecord> & Pick<LinkedInAccountRecord, "status">) {
    const now = new Date().toISOString();
    const current = this.state.accounts[0];
    const record: LinkedInAccountRecord = {
      ...current,
      ...input,
      id: current?.id || input.id || randomUUID(),
      status: input.status,
      grantedScopes: input.grantedScopes || current?.grantedScopes || [],
      createdAt: current?.createdAt || input.createdAt || now,
      updatedAt: now
    };
    this.state.accounts[0] = record;
    await this.changed();
    return structuredClone(record);
  }

  async disconnectAccount() {
    const current = this.state.accounts[0];
    if (!current) return;
    this.state.accounts[0] = {
      ...current,
      status: "disconnected",
      accessTokenEncrypted: undefined,
      refreshTokenEncrypted: undefined,
      accessTokenExpiresAt: undefined,
      refreshTokenExpiresAt: undefined,
      disconnectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await this.changed();
  }

  async createOAuthState(stateHash: string, expiresAt: string) {
    this.state.oauthStates.push({ id: randomUUID(), stateHash, expiresAt, createdAt: new Date().toISOString() });
    await this.changed();
  }

  async consumeOAuthState(stateHash: string, now = new Date().toISOString()) {
    const match = this.state.oauthStates.find((item) => item.stateHash === stateHash && !item.consumedAt);
    if (!match || Date.parse(match.expiresAt) <= Date.parse(now)) return false;
    match.consumedAt = now;
    await this.changed();
    return true;
  }

  async upsertPost(input: Partial<LinkedInPostRecord> & Pick<LinkedInPostRecord, "source" | "urnValidationStatus">) {
    const now = new Date().toISOString();
    const index = this.state.posts.findIndex((post) =>
      (input.id && post.id === input.id) ||
      (input.internalContentId && post.internalContentId === input.internalContentId) ||
      (input.linkedinUrn && post.linkedinUrn === input.linkedinUrn)
    );
    const current = index >= 0 ? this.state.posts[index] : undefined;
    const record: LinkedInPostRecord = {
      ...current,
      ...input,
      id: current?.id || input.id || randomUUID(),
      urnValidationStatus: input.urnValidationStatus,
      source: input.source,
      createdAt: current?.createdAt || input.createdAt || now,
      updatedAt: now
    };
    if (index >= 0) this.state.posts[index] = record;
    else this.state.posts.push(record);
    await this.changed();
    return structuredClone(record);
  }

  async getPost(id: string) {
    const record = this.state.posts.find((post) => post.id === id || post.internalContentId === id || post.linkedinUrn === id);
    return record && structuredClone(record);
  }

  async listPosts() { return structuredClone(this.state.posts).sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || "")); }

  async addPostSnapshot(input: Omit<LinkedInPostSnapshotRecord, "id" | "createdAt">) {
    const existing = this.state.postSnapshots.find((snapshot) => snapshot.idempotencyKey === input.idempotencyKey);
    if (existing) return { record: structuredClone(existing), created: false };
    const record = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    this.state.postSnapshots.push(record);
    await this.changed();
    return { record: structuredClone(record), created: true };
  }

  async listPostSnapshots(postId?: string) {
    return structuredClone(this.state.postSnapshots)
      .filter((snapshot) => !postId || snapshot.postId === postId)
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  }

  async addProfileSnapshot(input: Omit<LinkedInProfileSnapshotRecord, "id" | "createdAt">) {
    const existing = this.state.profileSnapshots.find((snapshot) => snapshot.idempotencyKey === input.idempotencyKey);
    if (existing) return { record: structuredClone(existing), created: false };
    const record = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    this.state.profileSnapshots.push(record);
    await this.changed();
    return { record: structuredClone(record), created: true };
  }

  async listProfileSnapshots(accountId?: string) {
    return structuredClone(this.state.profileSnapshots)
      .filter((snapshot) => !accountId || snapshot.accountId === accountId)
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  }

  async startSyncRun(trigger: LinkedInSyncRunRecord["trigger"], accountId?: string) {
    const now = new Date().toISOString();
    const record: LinkedInSyncRunRecord = {
      id: randomUUID(), accountId, status: "running", trigger, startedAt: now,
      callsUsed: 0, postsRead: 0, snapshotsCreated: 0, errorCount: 0, createdAt: now
    };
    this.state.syncRuns.push(record);
    await this.changed();
    return structuredClone(record);
  }

  async finishSyncRun(id: string, update: Partial<LinkedInSyncRunRecord>) {
    const index = this.state.syncRuns.findIndex((run) => run.id === id);
    if (index < 0) throw new Error("LinkedIn sync run not found");
    this.state.syncRuns[index] = { ...this.state.syncRuns[index], ...update };
    await this.changed();
    return structuredClone(this.state.syncRuns[index]);
  }

  async getLastSyncRun() {
    const record = [...this.state.syncRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    return record && structuredClone(record);
  }

  async countCallsSince(since: string) {
    return this.state.syncRuns.filter((run) => run.startedAt >= since).reduce((total, run) => total + run.callsUsed, 0);
  }

  async recordApiError(input: Omit<LinkedInApiErrorRecord, "id" | "occurredAt">) {
    const record = { ...input, id: randomUUID(), occurredAt: new Date().toISOString() };
    this.state.apiErrors.push(record);
    await this.changed();
    return structuredClone(record);
  }
}

export class JsonLinkedInStore extends MemoryLinkedInStore {
  readonly backend = "json" as const;
  private readonly path: string;
  constructor(path: string) {
    super(existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as LinkedInStoreState : {});
    this.path = path;
  }

  protected override async changed() {
    mkdirSync(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(this.state, null, 2) + "\n", "utf8");
    renameSync(temporary, this.path);
  }
}

function fromDbDate(value: unknown): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function cleanRow<T extends Record<string, unknown>>(row: T): T {
  const dateFields = ["createdAt", "updatedAt", "connectedAt", "disconnectedAt", "accessTokenExpiresAt", "refreshTokenExpiresAt", "lastSyncAt", "expiresAt", "consumedAt", "publishedAt", "capturedAt", "startedAt", "finishedAt", "occurredAt"];
  for (const field of dateFields) if (field in row && row[field]) row[field] = fromDbDate(row[field]) as T[keyof T];
  return row;
}

export class PostgresLinkedInStore implements LinkedInStore {
  readonly backend = "postgres" as const;
  private readonly pool: Pool;
  constructor(databaseUrl: string) { this.pool = new Pool({ connectionString: databaseUrl, max: 5 }); }

  private async one<T extends Record<string, unknown>>(sql: string, values: unknown[] = []): Promise<T | undefined> {
    const result = await this.pool.query(sql, values);
    return result.rows[0] ? cleanRow(result.rows[0] as T) : undefined;
  }

  async getAccount() { return this.one<LinkedInAccountRecord>('SELECT * FROM "LinkedInAccount" ORDER BY "createdAt" LIMIT 1'); }

  async upsertAccount(input: Partial<LinkedInAccountRecord> & Pick<LinkedInAccountRecord, "status">) {
    const current = await this.getAccount();
    const id = current?.id || input.id || randomUUID();
    const now = new Date().toISOString();
    const values = { ...current, ...input, id, grantedScopes: input.grantedScopes || current?.grantedScopes || [], createdAt: current?.createdAt || now, updatedAt: now };
    return (await this.one<LinkedInAccountRecord>(
      `INSERT INTO "LinkedInAccount" ("id","memberUrn","status","accessTokenEncrypted","refreshTokenEncrypted","accessTokenExpiresAt","refreshTokenExpiresAt","grantedScopes","connectedAt","disconnectedAt","lastSyncAt","lastSyncStatus","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT ("id") DO UPDATE SET "memberUrn"=EXCLUDED."memberUrn","status"=EXCLUDED."status","accessTokenEncrypted"=EXCLUDED."accessTokenEncrypted","refreshTokenEncrypted"=EXCLUDED."refreshTokenEncrypted","accessTokenExpiresAt"=EXCLUDED."accessTokenExpiresAt","refreshTokenExpiresAt"=EXCLUDED."refreshTokenExpiresAt","grantedScopes"=EXCLUDED."grantedScopes","connectedAt"=EXCLUDED."connectedAt","disconnectedAt"=EXCLUDED."disconnectedAt","lastSyncAt"=EXCLUDED."lastSyncAt","lastSyncStatus"=EXCLUDED."lastSyncStatus","updatedAt"=EXCLUDED."updatedAt" RETURNING *`,
      [values.id, values.memberUrn || null, values.status, values.accessTokenEncrypted || null, values.refreshTokenEncrypted || null, values.accessTokenExpiresAt || null, values.refreshTokenExpiresAt || null, values.grantedScopes, values.connectedAt || null, values.disconnectedAt || null, values.lastSyncAt || null, values.lastSyncStatus || null, values.createdAt, values.updatedAt]
    ))!;
  }

  async disconnectAccount() {
    await this.pool.query('UPDATE "LinkedInAccount" SET "status"=\'disconnected\',"accessTokenEncrypted"=NULL,"refreshTokenEncrypted"=NULL,"accessTokenExpiresAt"=NULL,"refreshTokenExpiresAt"=NULL,"disconnectedAt"=NOW(),"updatedAt"=NOW()');
  }

  async createOAuthState(stateHash: string, expiresAt: string) {
    await this.pool.query('INSERT INTO "LinkedInOAuthState" ("id","stateHash","expiresAt") VALUES ($1,$2,$3)', [randomUUID(), stateHash, expiresAt]);
  }

  async consumeOAuthState(stateHash: string, now = new Date().toISOString()) {
    const result = await this.pool.query('UPDATE "LinkedInOAuthState" SET "consumedAt"=$2 WHERE "stateHash"=$1 AND "consumedAt" IS NULL AND "expiresAt">$2 RETURNING "id"', [stateHash, now]);
    return result.rowCount === 1;
  }

  async upsertPost(input: Partial<LinkedInPostRecord> & Pick<LinkedInPostRecord, "source" | "urnValidationStatus">) {
    const existing = input.id ? await this.getPost(input.id) : input.internalContentId ? await this.getPost(input.internalContentId) : input.linkedinUrn ? await this.getPost(input.linkedinUrn) : undefined;
    const now = new Date().toISOString();
    const value = { ...existing, ...input, id: existing?.id || input.id || randomUUID(), createdAt: existing?.createdAt || now, updatedAt: now };
    return (await this.one<LinkedInPostRecord>(
      `INSERT INTO "LinkedInPost" ("id","internalContentId","linkedinUrn","linkedinUrl","activityId","urnValidationStatus","publishedAt","author","text","hook","format","editorialFamily","decisionId","experimentId","source","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT ("id") DO UPDATE SET "internalContentId"=EXCLUDED."internalContentId","linkedinUrn"=EXCLUDED."linkedinUrn","linkedinUrl"=EXCLUDED."linkedinUrl","activityId"=EXCLUDED."activityId","urnValidationStatus"=EXCLUDED."urnValidationStatus","publishedAt"=EXCLUDED."publishedAt","author"=EXCLUDED."author","text"=EXCLUDED."text","hook"=EXCLUDED."hook","format"=EXCLUDED."format","editorialFamily"=EXCLUDED."editorialFamily","decisionId"=EXCLUDED."decisionId","experimentId"=EXCLUDED."experimentId","source"=EXCLUDED."source","updatedAt"=EXCLUDED."updatedAt" RETURNING *`,
      [value.id,value.internalContentId||null,value.linkedinUrn||null,value.linkedinUrl||null,value.activityId||null,value.urnValidationStatus,value.publishedAt||null,value.author||null,value.text||null,value.hook||null,value.format||null,value.editorialFamily||null,value.decisionId||null,value.experimentId||null,value.source,value.createdAt,value.updatedAt]
    ))!;
  }

  async getPost(id: string) { return this.one<LinkedInPostRecord>('SELECT * FROM "LinkedInPost" WHERE "id"=$1 OR "internalContentId"=$1 OR "linkedinUrn"=$1 LIMIT 1', [id]); }
  async listPosts() { const result = await this.pool.query('SELECT * FROM "LinkedInPost" ORDER BY "publishedAt" DESC NULLS LAST'); return result.rows.map((row) => cleanRow(row) as LinkedInPostRecord); }

  async addPostSnapshot(input: Omit<LinkedInPostSnapshotRecord, "id" | "createdAt">) {
    const record = await this.one<LinkedInPostSnapshotRecord>(
      `INSERT INTO "LinkedInPostSnapshot" ("id","postId","capturedAt","milestone","source","impressions","membersReached","reactions","comments","reshares","postSaves","postSends","followersGained","profileViewsFromContent","linkClicks","premiumCtaClicks","rawPayload","dataQualityNote","idempotencyKey") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) ON CONFLICT ("idempotencyKey") DO NOTHING RETURNING *`,
      [randomUUID(),input.postId,input.capturedAt,input.milestone,input.source,input.impressions,input.membersReached,input.reactions,input.comments,input.reshares,input.postSaves,input.postSends,input.followersGained,input.profileViewsFromContent,input.linkClicks,input.premiumCtaClicks,JSON.stringify(input.rawPayload),input.dataQualityNote||null,input.idempotencyKey]
    );
    if (record) return { record, created: true };
    const existing = await this.one<LinkedInPostSnapshotRecord>('SELECT * FROM "LinkedInPostSnapshot" WHERE "idempotencyKey"=$1', [input.idempotencyKey]);
    return { record: existing!, created: false };
  }

  async listPostSnapshots(postId?: string) { const result = await this.pool.query(`SELECT * FROM "LinkedInPostSnapshot" ${postId ? 'WHERE "postId"=$1' : ''} ORDER BY "capturedAt"`, postId ? [postId] : []); return result.rows.map((row) => cleanRow(row) as LinkedInPostSnapshotRecord); }

  async addProfileSnapshot(input: Omit<LinkedInProfileSnapshotRecord, "id" | "createdAt">) {
    const record = await this.one<LinkedInProfileSnapshotRecord>('INSERT INTO "LinkedInProfileSnapshot" ("id","accountId","capturedAt","followersTotal","source","rawPayload","dataQualityNote","idempotencyKey") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT ("idempotencyKey") DO NOTHING RETURNING *', [randomUUID(),input.accountId,input.capturedAt,input.followersTotal,input.source,JSON.stringify(input.rawPayload),input.dataQualityNote||null,input.idempotencyKey]);
    if (record) return { record, created: true };
    const existing = await this.one<LinkedInProfileSnapshotRecord>('SELECT * FROM "LinkedInProfileSnapshot" WHERE "idempotencyKey"=$1', [input.idempotencyKey]);
    return { record: existing!, created: false };
  }

  async listProfileSnapshots(accountId?: string) { const result = await this.pool.query(`SELECT * FROM "LinkedInProfileSnapshot" ${accountId ? 'WHERE "accountId"=$1' : ''} ORDER BY "capturedAt"`, accountId ? [accountId] : []); return result.rows.map((row) => cleanRow(row) as LinkedInProfileSnapshotRecord); }

  async startSyncRun(trigger: LinkedInSyncRunRecord["trigger"], accountId?: string) {
    const now = new Date().toISOString();
    return (await this.one<LinkedInSyncRunRecord>('INSERT INTO "LinkedInSyncRun" ("id","accountId","status","trigger","startedAt") VALUES ($1,$2,\'running\',$3,$4) RETURNING *', [randomUUID(), accountId || null, trigger, now]))!;
  }

  async finishSyncRun(id: string, update: Partial<LinkedInSyncRunRecord>) {
    return (await this.one<LinkedInSyncRunRecord>('UPDATE "LinkedInSyncRun" SET "status"=$2,"finishedAt"=$3,"callsUsed"=$4,"postsRead"=$5,"snapshotsCreated"=$6,"errorCount"=$7,"durationMs"=$8 WHERE "id"=$1 RETURNING *', [id,update.status,update.finishedAt||null,update.callsUsed||0,update.postsRead||0,update.snapshotsCreated||0,update.errorCount||0,update.durationMs||null]))!;
  }

  async getLastSyncRun() { return this.one<LinkedInSyncRunRecord>('SELECT * FROM "LinkedInSyncRun" ORDER BY "startedAt" DESC LIMIT 1'); }
  async countCallsSince(since: string) { const row = await this.one<{ total: string }>('SELECT COALESCE(SUM("callsUsed"),0)::text AS total FROM "LinkedInSyncRun" WHERE "startedAt">=$1', [since]); return Number(row?.total || 0); }

  async recordApiError(input: Omit<LinkedInApiErrorRecord, "id" | "occurredAt">) {
    return (await this.one<LinkedInApiErrorRecord>('INSERT INTO "LinkedInApiError" ("id","syncRunId","postId","code","httpStatus","message","retryable","metadata") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [randomUUID(),input.syncRunId||null,input.postId||null,input.code,input.httpStatus||null,input.message,input.retryable,input.metadata ? JSON.stringify(input.metadata) : null]))!;
  }

  async close() { await this.pool.end(); }
}

export function createLinkedInStore(options: { databaseUrl?: string; storage: "json" | "postgres"; jsonPath: string }): LinkedInStore {
  if (options.storage === "postgres") {
    if (!options.databaseUrl) throw new Error("LINKEDIN_STORAGE=postgres requires DATABASE_URL");
    return new PostgresLinkedInStore(options.databaseUrl);
  }
  return new JsonLinkedInStore(options.jsonPath);
}
