import { createSign } from "node:crypto";

interface TokenResponse { access_token: string; expires_in: number }

let tokenCache: { token: string; expiresAt: number } | null = null;

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

async function getAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !privateKey) throw new Error("Falten les credencials del compte de servei de Google");

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3_600,
    iat: now,
  }));
  const input = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(input);
  const assertion = `${input}.${signer.sign(privateKey, "base64url")}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google OAuth ha respost ${response.status}`);
  const result = (await response.json()) as TokenResponse;
  tokenCache = { token: result.access_token, expiresAt: Date.now() + result.expires_in * 1000 };
  return result.access_token;
}

export async function readSheetRange(spreadsheetId: string | undefined, range: string) {
  if (!spreadsheetId) throw new Error(`No s'ha configurat el full per a ${range}`);
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`;
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` }, next: { revalidate: 300 } });
  if (!response.ok) throw new Error(`Google Sheets ha respost ${response.status} per ${range}`);
  const result = (await response.json()) as { values?: unknown[][] };
  return result.values ?? [];
}

export function rowsToRecords(values: unknown[][]) {
  const [headers = [], ...rows] = values;
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [String(header).trim(), row[index] ?? null])));
}
