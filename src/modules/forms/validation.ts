import type { FormField, FormFieldType } from "@prisma/client";
import { normalizeEmail, normalizePhone, sanitizeText } from "@/lib/normalization";

export type PublicFormValue = string | number | boolean | string[] | null;

export type PublicFormData = Record<string, PublicFormValue>;

export function validateDynamicForm(fields: FormField[], raw: Record<string, unknown>) {
  const data: PublicFormData = {};
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const rawValue = raw[field.name];
    const empty = rawValue === undefined || rawValue === null || rawValue === "" || rawValue === false || (Array.isArray(rawValue) && rawValue.length === 0);
    if (field.required && empty) {
      errors[field.name] = `${field.label} es obligatorio`;
      continue;
    }
    if (empty) {
      data[field.name] = field.type === "CHECKBOX" ? false : field.type === "MULTI_CHECKBOX" ? [] : null;
      continue;
    }

    const parsed = parseField(field.type, rawValue);
    if (parsed.error) errors[field.name] = parsed.error;
    else data[field.name] = parsed.value ?? null;

    if ((field.type === "SELECT" || field.type === "RADIO") && parsed.value) {
      const options = Array.isArray(field.options) ? field.options.map(String) : [];
      if (options.length && !options.includes(String(parsed.value))) errors[field.name] = "Opción no válida";
    }
    if (field.type === "MULTI_CHECKBOX" && Array.isArray(parsed.value)) {
      const options = Array.isArray(field.options) ? field.options.map(String) : [];
      if (options.length && parsed.value.some((value) => !options.includes(value))) errors[field.name] = "Opción no válida";
    }
  }

  return { success: Object.keys(errors).length === 0, data, errors };
}

function parseField(type: FormFieldType, rawValue: unknown): { value?: PublicFormValue; error?: string } {
  if (type === "CHECKBOX") {
    const checked = rawValue === true || rawValue === "true" || rawValue === "1" || rawValue === "on";
    return { value: checked };
  }
  if (type === "MULTI_CHECKBOX") {
    const values = (Array.isArray(rawValue) ? rawValue : [rawValue])
      .map((value) => sanitizeText(String(value), 500))
      .filter(Boolean);
    return { value: [...new Set(values)] };
  }
  const value = sanitizeText(String(rawValue), type === "TEXTAREA" ? 10_000 : 500);
  if (type === "EMAIL") {
    const normalized = normalizeEmail(value);
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return { error: "Correo electrónico no válido" };
    return { value: normalized };
  }
  if (type === "PHONE") {
    const normalized = normalizePhone(value);
    if (!normalized) return { error: "Teléfono no válido" };
    return { value: normalized };
  }
  if (type === "NUMBER") {
    const number = Number(value.replace(",", "."));
    return Number.isFinite(number) ? { value: number } : { error: "Número no válido" };
  }
  return { value };
}
