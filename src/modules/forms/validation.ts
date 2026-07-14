import type { FormField, FormFieldType } from "@prisma/client";
import { normalizeEmail, normalizePhone, sanitizeText } from "@/lib/normalization";

export type PublicFormValue = string | number | boolean | null;

export type PublicFormData = Record<string, PublicFormValue>;

export function validateDynamicForm(fields: FormField[], raw: Record<string, unknown>) {
  const data: PublicFormData = {};
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const rawValue = raw[field.name];
    const empty = rawValue === undefined || rawValue === null || rawValue === "" || rawValue === false;
    if (field.required && empty) {
      errors[field.name] = `${field.label} és obligatori`;
      continue;
    }
    if (empty) {
      data[field.name] = field.type === "CHECKBOX" ? false : null;
      continue;
    }

    const parsed = parseField(field.type, rawValue);
    if (parsed.error) errors[field.name] = parsed.error;
    else data[field.name] = parsed.value ?? null;

    if (field.type === "SELECT" && parsed.value) {
      const options = Array.isArray(field.options) ? field.options.map(String) : [];
      if (options.length && !options.includes(String(parsed.value))) errors[field.name] = "Opció no vàlida";
    }
  }

  return { success: Object.keys(errors).length === 0, data, errors };
}

function parseField(type: FormFieldType, rawValue: unknown): { value?: PublicFormValue; error?: string } {
  if (type === "CHECKBOX") {
    const checked = rawValue === true || rawValue === "true" || rawValue === "1" || rawValue === "on";
    return { value: checked };
  }
  const value = sanitizeText(String(rawValue), type === "TEXTAREA" ? 10_000 : 500);
  if (type === "EMAIL") {
    const normalized = normalizeEmail(value);
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return { error: "Correu electrònic no vàlid" };
    return { value: normalized };
  }
  if (type === "PHONE") {
    const normalized = normalizePhone(value);
    if (!normalized) return { error: "Telèfon no vàlid" };
    return { value: normalized };
  }
  if (type === "NUMBER") {
    const number = Number(value.replace(",", "."));
    return Number.isFinite(number) ? { value: number } : { error: "Número no vàlid" };
  }
  return { value };
}
