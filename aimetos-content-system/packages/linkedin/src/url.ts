export type ParsedLinkedInPostUrl = {
  normalizedUrl: string;
  activityId?: string;
  candidateUrn?: string;
  validationStatus: "missing" | "pending_api_validation";
};

export function parseLinkedInPostUrl(value: string): ParsedLinkedInPostUrl {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("LinkedIn post URL is not a valid absolute URL");
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "linkedin.com" && host !== "lnkd.in") throw new Error("Only official LinkedIn URLs are accepted");
  url.hash = "";

  const shareMatch = url.pathname.match(/(?:^|[-/])share-(\d{8,})(?:-|\/|$)/i);
  const activityMatch = url.pathname.match(/(?:^|[-/])activity-(\d{8,})(?:-|\/|$)/i);
  const activityId = shareMatch?.[1] || activityMatch?.[1];
  return {
    normalizedUrl: url.toString(),
    activityId,
    candidateUrn: shareMatch ? `urn:li:share:${shareMatch[1]}` : undefined,
    validationStatus: shareMatch ? "pending_api_validation" : "missing"
  };
}

export function encodeRestliEntity(urn: string): string {
  const match = urn.match(/^urn:li:(share|ugcPost):(\d+)$/);
  if (!match) throw new Error("Unsupported LinkedIn post URN");
  const discriminator = match[1] === "ugcPost" ? "ugc" : "share";
  return `(${discriminator}:${encodeURIComponent(urn)})`;
}
