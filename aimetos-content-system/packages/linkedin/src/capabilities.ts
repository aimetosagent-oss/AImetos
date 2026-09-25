export type LinkedInCapabilityStatus =
  | "AVAILABLE_NOW"
  | "REQUIRES_LINKEDIN_APPROVAL"
  | "NOT_AVAILABLE_WITH_CURRENT_PERMISSIONS";

export const LINKEDIN_CAPABILITIES = [
  { key: "oauth", label: "OAuth 2.0 oficial i registre únic d'URL/URN", status: "AVAILABLE_NOW" },
  { key: "post_analytics", label: "Analítica de publicacions personals", status: "REQUIRES_LINKEDIN_APPROVAL", scope: "r_member_postAnalytics" },
  { key: "followers", label: "Comptador de seguidors", status: "REQUIRES_LINKEDIN_APPROVAL", scope: "r_member_profileAnalytics" },
  { key: "post_discovery", label: "Enumeració automàtica de publicacions personals", status: "NOT_AVAILABLE_WITH_CURRENT_PERMISSIONS", scope: "r_member_social" },
  { key: "post_text_comments", label: "Text i comentaris de publicacions personals", status: "NOT_AVAILABLE_WITH_CURRENT_PERMISSIONS", scope: "r_member_social" },
  { key: "audience_breakdown", label: "Desglossament d'audiència per post", status: "NOT_AVAILABLE_WITH_CURRENT_PERMISSIONS" },
  { key: "profile_viewers_search", label: "Detall de visitants i aparicions de cerca", status: "NOT_AVAILABLE_WITH_CURRENT_PERMISSIONS" }
] as const satisfies ReadonlyArray<{ key: string; label: string; status: LinkedInCapabilityStatus; scope?: string }>;

export const REQUIRED_LINKEDIN_SCOPES = ["r_member_postAnalytics", "r_member_profileAnalytics"] as const;
