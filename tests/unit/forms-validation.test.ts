import { describe, expect, it } from "vitest";
import type { FormField } from "@prisma/client";
import { validateDynamicForm } from "@/modules/forms/validation";

const fields = [
  { id: "1", organizationId: "org", formId: "form", label: "Correu", name: "email", type: "EMAIL", required: true, placeholder: null, options: null, defaultValue: null, position: 0, createdAt: new Date(), updatedAt: new Date() },
  { id: "2", organizationId: "org", formId: "form", label: "Interès", name: "interest", type: "SELECT", required: false, placeholder: null, options: ["CRM", "Agents"], defaultValue: null, position: 1, createdAt: new Date(), updatedAt: new Date() },
  { id: "3", organizationId: "org", formId: "form", label: "Urgència", name: "urgency", type: "RADIO", required: true, placeholder: null, options: ["Ara", "Més endavant"], defaultValue: null, position: 2, createdAt: new Date(), updatedAt: new Date() },
  { id: "4", organizationId: "org", formId: "form", label: "Canals", name: "channels", type: "MULTI_CHECKBOX", required: true, placeholder: null, options: ["Web", "WhatsApp"], defaultValue: null, position: 3, createdAt: new Date(), updatedAt: new Date() },
] satisfies FormField[];

describe("formularis dinàmics", () => {
  it("normalitza valors vàlids", () => {
    const result = validateDynamicForm(fields, { email: " TEST@EXAMPLE.COM ", interest: "CRM", urgency: "Ara", channels: ["Web"] });
    expect(result.success).toBe(true);
    expect(result.data.email).toBe("test@example.com");
  });

  it("rebutja obligatoris i opcions desconegudes", () => {
    expect(validateDynamicForm(fields, { email: "", interest: "Altres" })).toMatchObject({
      success: false,
      errors: { email: "Correu es obligatorio", interest: "Opción no válida" },
    });
  });

  it("valida opcions úniques i múltiples", () => {
    const result = validateDynamicForm(fields, {
      email: "test@example.com",
      urgency: "Ara",
      channels: ["Web", "WhatsApp", "Web"],
    });
    expect(result).toMatchObject({
      success: true,
      data: { urgency: "Ara", channels: ["Web", "WhatsApp"] },
    });
  });

  it("rebutja opcions múltiples desconegudes", () => {
    expect(validateDynamicForm(fields, {
      email: "test@example.com",
      urgency: "Ara",
      channels: ["Telegram"],
    })).toMatchObject({ success: false, errors: { channels: "Opción no válida" } });
  });
});
