import { createHash, randomBytes } from "node:crypto";

export function publicToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
