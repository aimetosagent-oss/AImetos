import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "aimetos_control_session";

function secret() {
  return process.env.AUTH_SECRET || "local-development-secret-change-in-production";
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionValue() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 12 * 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function isValidSession(value?: string) {
  if (!value) return false;
  const [payload, suppliedSignature] = value.split(".");
  if (!payload || !suppliedSignature) return false;
  const expected = signature(payload);
  if (expected.length !== suppliedSignature.length) return false;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(suppliedSignature))) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof parsed.exp === "number" && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

export async function requireSession() {
  const store = await cookies();
  if (!isValidSession(store.get(COOKIE_NAME)?.value)) redirect("/login");
}

export { COOKIE_NAME };
