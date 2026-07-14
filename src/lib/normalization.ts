const whitespace = /\s+/g;

export function normalizeEmail(value: string | null | undefined) {
  const email = value?.trim().toLocaleLowerCase("ca");
  return email || null;
}

export function normalizePhone(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.length === 9) return `+34${digits}`;
  return `+${digits}`;
}

export function sanitizeText(value: string | null | undefined, maxLength = 10_000) {
  if (!value) return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(whitespace, " ")
    .trim()
    .slice(0, maxLength);
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
