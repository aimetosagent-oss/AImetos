import { encodeRestliEntity } from "./url.ts";

export const POST_ANALYTICS_METRICS = [
  "IMPRESSION",
  "MEMBERS_REACHED",
  "RESHARE",
  "REACTION",
  "COMMENT",
  "POST_SAVE",
  "POST_SEND",
  "LINK_CLICKS",
  "PREMIUM_CTA_CLICKS",
  "FOLLOWER_GAINED_FROM_CONTENT",
  "PROFILE_VIEW_FROM_CONTENT"
] as const;

export type LinkedInPostMetric = typeof POST_ANALYTICS_METRICS[number];
export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class LinkedInApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly retryable: boolean;
  constructor(
    message: string,
    code: string,
    status?: number,
    retryable = false
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export type LinkedInClientOptions = {
  apiVersion: string;
  fetch?: FetchLike;
  maxRetries?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  baseUrl?: string;
};

type AnalyticsResponse = { elements?: Array<{ count?: number; metricType?: unknown; targetEntity?: unknown }>; paging?: unknown };

function safeApiMessage(status: number): string {
  if (status === 401) return "LinkedIn authorization expired or is invalid";
  if (status === 403) return "LinkedIn product approval or required scope is missing";
  if (status === 429) return "LinkedIn API rate limit reached";
  return `LinkedIn API request failed (${status})`;
}

export class LinkedInClient {
  private readonly fetchFn: FetchLike;
  private readonly maxRetries: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly baseUrl: string;
  private readonly options: LinkedInClientOptions;
  callsUsed = 0;

  constructor(options: LinkedInClientOptions) {
    this.options = options;
    this.fetchFn = options.fetch || globalThis.fetch;
    this.maxRetries = options.maxRetries ?? 2;
    this.sleep = options.sleep || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.baseUrl = options.baseUrl || "https://api.linkedin.com";
  }

  private async request<T>(path: string, accessToken: string): Promise<T> {
    let attempt = 0;
    while (true) {
      this.callsUsed += 1;
      let response: Response;
      try {
        response = await this.fetchFn(`${this.baseUrl}${path}`, {
          headers: {
            authorization: `Bearer ${accessToken}`,
            "linkedin-version": this.options.apiVersion,
            "x-restli-protocol-version": "2.0.0",
            accept: "application/json"
          }
        });
      } catch {
        if (attempt < this.maxRetries) {
          await this.sleep(250 * 2 ** attempt++);
          continue;
        }
        throw new LinkedInApiError("LinkedIn API is unavailable", "NETWORK_ERROR", undefined, true);
      }
      if (response.ok) return await response.json() as T;
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < this.maxRetries) {
        const retryAfter = Number(response.headers.get("retry-after") || 0) * 1000;
        await this.sleep(retryAfter || 250 * 2 ** attempt++);
        continue;
      }
      const code = response.status === 401 ? "TOKEN_EXPIRED" : response.status === 403 ? "APPROVAL_REQUIRED" : response.status === 429 ? "RATE_LIMITED" : "LINKEDIN_API_ERROR";
      throw new LinkedInApiError(safeApiMessage(response.status), code, response.status, retryable);
    }
  }

  async getPostMetric(accessToken: string, urn: string, metric: LinkedInPostMetric) {
    const entity = encodeRestliEntity(urn);
    const path = `/rest/memberCreatorPostAnalytics?q=entity&entity=${entity}&queryType=${metric}&aggregation=TOTAL`;
    const raw = await this.request<AnalyticsResponse>(path, accessToken);
    const count = raw.elements?.reduce((total, element) => total + (Number(element.count) || 0), 0) || 0;
    return { metric, count, raw };
  }

  async getAllPostMetrics(accessToken: string, urn: string) {
    const results: Partial<Record<LinkedInPostMetric, number>> = {};
    const raw: Partial<Record<LinkedInPostMetric, unknown>> = {};
    for (const metric of POST_ANALYTICS_METRICS) {
      const response = await this.getPostMetric(accessToken, urn, metric);
      results[metric] = response.count;
      raw[metric] = response.raw;
    }
    return { metrics: results, raw };
  }

  async getFollowersCount(accessToken: string) {
    const raw = await this.request<{ elements?: Array<{ memberFollowersCount?: number }> }>("/rest/memberFollowersCount?q=me", accessToken);
    return { followersTotal: Number(raw.elements?.[0]?.memberFollowersCount || 0), raw };
  }
}

export type OAuthTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
};

export async function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetch?: FetchLike;
}): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri
  });
  const response = await (input.fetch || globalThis.fetch)("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) throw new LinkedInApiError("LinkedIn OAuth token exchange failed", "OAUTH_EXCHANGE_FAILED", response.status, response.status >= 500);
  return await response.json() as OAuthTokenResponse;
}
