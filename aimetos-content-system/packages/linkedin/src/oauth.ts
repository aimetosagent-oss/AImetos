import { randomBytes } from "node:crypto";
import type { LinkedInStore } from "../../database/src/linkedin-store.ts";
import { encryptSecret, hashOAuthState } from "./crypto.ts";
import { exchangeAuthorizationCode, type FetchLike } from "./client.ts";
import { REQUIRED_LINKEDIN_SCOPES } from "./capabilities.ts";

export type LinkedInOAuthConfig = {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  tokenEncryptionKey?: string;
};

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export class LinkedInOAuthService {
  private readonly config: LinkedInOAuthConfig;
  private readonly store: LinkedInStore;
  private readonly fetchFn?: FetchLike;
  constructor(
    config: LinkedInOAuthConfig,
    store: LinkedInStore,
    fetchFn?: FetchLike
  ) {
    this.config = config;
    this.store = store;
    this.fetchFn = fetchFn;
  }

  isConfigured() {
    return Boolean(this.config.clientId && this.config.clientSecret && this.config.redirectUri && this.config.tokenEncryptionKey);
  }

  async createAuthorizationUrl() {
    const state = randomBytes(32).toString("base64url");
    await this.store.createOAuthState(hashOAuthState(state), new Date(Date.now() + 10 * 60_000).toISOString());
    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", required(this.config.clientId, "LINKEDIN_CLIENT_ID"));
    url.searchParams.set("redirect_uri", required(this.config.redirectUri, "LINKEDIN_REDIRECT_URI"));
    url.searchParams.set("state", state);
    url.searchParams.set("scope", REQUIRED_LINKEDIN_SCOPES.join(" "));
    return url.toString();
  }

  async completeAuthorization(code: string, state: string) {
    if (!code || !state) throw new Error("LinkedIn OAuth callback is missing code or state");
    const valid = await this.store.consumeOAuthState(hashOAuthState(state));
    if (!valid) throw new Error("LinkedIn OAuth state is invalid or expired");
    const response = await exchangeAuthorizationCode({
      code,
      clientId: required(this.config.clientId, "LINKEDIN_CLIENT_ID"),
      clientSecret: required(this.config.clientSecret, "LINKEDIN_CLIENT_SECRET"),
      redirectUri: required(this.config.redirectUri, "LINKEDIN_REDIRECT_URI"),
      fetch: this.fetchFn
    });
    const now = Date.now();
    const key = required(this.config.tokenEncryptionKey, "LINKEDIN_TOKEN_ENCRYPTION_KEY");
    const grantedScopes = response.scope?.split(/[ ,]+/).filter(Boolean) || [];
    return this.store.upsertAccount({
      status: "connected",
      accessTokenEncrypted: encryptSecret(response.access_token, key),
      refreshTokenEncrypted: response.refresh_token ? encryptSecret(response.refresh_token, key) : undefined,
      accessTokenExpiresAt: new Date(now + response.expires_in * 1000).toISOString(),
      refreshTokenExpiresAt: response.refresh_token_expires_in ? new Date(now + response.refresh_token_expires_in * 1000).toISOString() : undefined,
      grantedScopes,
      connectedAt: new Date(now).toISOString(),
      disconnectedAt: undefined,
      lastSyncStatus: "pending"
    });
  }
}
