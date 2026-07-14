import { isIP } from "node:net";

export type PublicRequestIdentity = {
  ip?: string;
  rateLimitKey: string;
};

function normalizedIp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const candidate = value.trim();
  if (isIP(candidate)) return candidate.toLowerCase();
  const bracketed = /^\[([^\]]+)](?::\d+)?$/.exec(candidate)?.[1];
  return bracketed && isIP(bracketed) ? bracketed.toLowerCase() : undefined;
}

function configuredProxyHops(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) return 0;
  const hops = Number(value);
  return Number.isSafeInteger(hops) && hops >= 1 && hops <= 10 ? hops : 0;
}

/**
 * Proxy headers are untrusted unless the deployment explicitly declares how
 * many reverse-proxy hops it controls. Selection is from the right side of
 * X-Forwarded-For, so client-supplied prefixes cannot override the address
 * appended by the trusted proxy chain.
 */
export function publicRequestIdentity(
  headers: Pick<Headers, "get">,
  trustedProxyHops = configuredProxyHops(process.env.PUBLIC_FORM_TRUSTED_PROXY_HOPS),
): PublicRequestIdentity {
  const safeProxyHops = Number.isSafeInteger(trustedProxyHops) && trustedProxyHops >= 1 && trustedProxyHops <= 10
    ? trustedProxyHops
    : 0;
  if (safeProxyHops > 0) {
    const rawChain = (headers.get("x-forwarded-for") ?? "").split(",").map((entry) => entry.trim());
    const clientIndex = rawChain.length - safeProxyHops;
    const trustedSuffix = clientIndex >= 0 ? rawChain.slice(clientIndex).map(normalizedIp) : [];
    const trustedClient = trustedSuffix[0];
    if (trustedSuffix.length === safeProxyHops && trustedSuffix.every(Boolean) && trustedClient) {
      return { ip: trustedClient, rateLimitKey: `ip:${trustedClient}` };
    }
  }

  // Request does not expose the peer socket address in this runtime. This
  // stable, privacy-minimal browser fingerprint is a conservative fallback;
  // unlike a random request id, repeated requests share one rate-limit bucket.
  const userAgent = (headers.get("user-agent") ?? "unknown").slice(0, 300);
  const language = (headers.get("accept-language") ?? "unknown").slice(0, 100);
  const clientHints = (headers.get("sec-ch-ua") ?? "unknown").slice(0, 200);
  return { rateLimitKey: `fingerprint:${userAgent}|${language}|${clientHints}` };
}
