import { join } from "node:path";
import type { RuntimeConfig } from "../../config/src/env.ts";
import { validateLinkedInApiVersion } from "../../config/src/env.ts";
import { createLinkedInStore, type LinkedInPostRecord, type LinkedInStore } from "../../database/src/linkedin-store.ts";
import type { RealContentRecord } from "../../shared/src/domain.ts";
import { backfillLinkedInHistory, mergeLinkedInApiData } from "./backfill.ts";
import { LINKEDIN_CAPABILITIES, REQUIRED_LINKEDIN_SCOPES } from "./capabilities.ts";
import { LinkedInClient } from "./client.ts";
import { LinkedInOAuthService } from "./oauth.ts";
import { LinkedInSyncService } from "./sync.ts";
import { parseLinkedInPostUrl } from "./url.ts";

export class LinkedInRuntime {
  readonly store: LinkedInStore;
  readonly oauth: LinkedInOAuthService;
  readonly sync?: LinkedInSyncService;
  private initialized = false;
  private readonly config: RuntimeConfig;
  private readonly root: string;

  constructor(config: RuntimeConfig, root: string) {
    this.config = config;
    this.root = root;
    this.store = createLinkedInStore({
      databaseUrl: config.databaseUrl,
      storage: config.linkedIn.storage,
      jsonPath: join(root, "data", "runtime", "linkedin-store.json")
    });
    this.oauth = new LinkedInOAuthService(config.linkedIn, this.store);
    if (config.linkedIn.apiVersion && config.linkedIn.tokenEncryptionKey) {
      this.sync = new LinkedInSyncService({
        store: this.store,
        client: new LinkedInClient({ apiVersion: config.linkedIn.apiVersion }),
        encryptionKey: config.linkedIn.tokenEncryptionKey,
        maxCallsPerDay: config.linkedIn.maxCallsPerDay
      });
    }
  }

  async initialize(records: RealContentRecord[], knownUrls: Record<string, string> = {}) {
    if (this.initialized) return;
    await backfillLinkedInHistory(this.store, records, knownUrls);
    this.initialized = true;
  }

  async editorialRecords(records: RealContentRecord[]) {
    return mergeLinkedInApiData(this.store, records);
  }

  async registerPost(input: {
    url: string;
    linkedinUrn?: string;
    internalContentId?: string;
    publishedAt?: string;
    hook?: string;
    format?: string;
    editorialFamily?: string;
  }): Promise<LinkedInPostRecord> {
    const parsed = parseLinkedInPostUrl(input.url);
    const explicitUrn = input.linkedinUrn?.trim();
    if (explicitUrn && !/^urn:li:(share|ugcPost):\d+$/.test(explicitUrn)) {
      throw new Error("LinkedIn URN must use urn:li:share:<id> or urn:li:ugcPost:<id>");
    }
    return this.store.upsertPost({
      internalContentId: input.internalContentId?.trim() || undefined,
      linkedinUrl: parsed.normalizedUrl,
      linkedinUrn: explicitUrn || parsed.candidateUrn,
      activityId: parsed.activityId,
      urnValidationStatus: explicitUrn ? "pending_api_validation" : parsed.validationStatus,
      publishedAt: input.publishedAt,
      hook: input.hook,
      format: input.format,
      editorialFamily: input.editorialFamily,
      source: "manual_export"
    });
  }

  async status() {
    const account = await this.store.getAccount();
    const lastRun = await this.store.getLastSyncRun();
    const posts = await this.store.listPosts();
    const version = validateLinkedInApiVersion(this.config.linkedIn.apiVersion);
    const missingConfig = [
      ["LINKEDIN_CLIENT_ID", this.config.linkedIn.clientId],
      ["LINKEDIN_CLIENT_SECRET", this.config.linkedIn.clientSecret],
      ["LINKEDIN_REDIRECT_URI", this.config.linkedIn.redirectUri],
      ["LINKEDIN_API_VERSION", this.config.linkedIn.apiVersion],
      ["LINKEDIN_TOKEN_ENCRYPTION_KEY", this.config.linkedIn.tokenEncryptionKey]
    ].filter(([, value]) => !value).map(([name]) => name);
    const missingScopes = REQUIRED_LINKEDIN_SCOPES.filter((scope) => !account?.grantedScopes.includes(scope));
    const integrationStatus = account?.status === "connected"
      ? "connected"
      : account?.status === "warning"
        ? "warning"
        : account?.status === "awaiting_approval"
          ? "awaiting_linkedin_approval"
          : missingConfig.length > 0
            ? "awaiting_linkedin_approval"
            : "disconnected";
    return {
      integrationStatus,
      connected: account?.status === "connected",
      syncEnabled: this.config.linkedIn.syncEnabled,
      fixtureMode: this.config.linkedIn.fixtureMode,
      storage: this.store.backend,
      apiVersion: this.config.linkedIn.apiVersion || null,
      apiVersionStatus: version.reason,
      configured: missingConfig.length === 0 && version.valid,
      missingConfig,
      requiredScopes: [...REQUIRED_LINKEDIN_SCOPES],
      missingScopes,
      lastSync: account?.lastSyncAt || lastRun?.finishedAt || null,
      syncStatus: account?.lastSyncStatus || lastRun?.status || "not_run",
      registeredPosts: posts.length,
      postsWithValidatedUrn: posts.filter((post) => post.urnValidationStatus === "validated").length,
      postsAwaitingUrnValidation: posts.filter((post) => post.urnValidationStatus === "pending_api_validation").length,
      manualUrlFallbackRequired: posts.filter((post) => !post.linkedinUrl).length,
      capabilities: LINKEDIN_CAPABILITIES,
      blocker: integrationStatus === "awaiting_linkedin_approval"
        ? "LinkedIn ha d'aprovar el Development Tier de Community Management API i els scopes d'analítica de membre per a aquesta app."
        : null,
      reconnectRequired: account?.lastSyncStatus === "token_expired",
      dataQualityNote: "Les dades de l'API de LinkedIn es guarden separades dels exports manuals i poden diferir de la interfície de LinkedIn."
    };
  }
}
