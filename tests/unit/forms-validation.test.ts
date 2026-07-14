import { describe, expect, it } from "vitest";
import type { FormField } from "@prisma/client";
import { validateDynamicForm } from "@/modules/forms/validation";

const fields = [
  { id: "1", organizationId: "org", formId: "form", label: "Correu", name: "email", type: "EMAIL", required: true, placeholder: null, options: null, defaultValue: null, position: 0, createdAt: new Date(), updatedAt: new Date() },
  { id: "2", organizationId: "org", formId: "form", label: "Interès", name: "interest", type: "SELECT", required: false, placeholder: null, options: ["CRM", "Agents"], defaultValue: null, position: 1, createdAt: new Date(), updatedAt: new Date() },
] satisfies FormField[];

describe("formularis dinàmics", () => {
  it("normalitza valors vàlids", () => {
    const result = validateDynamicForm(fields, { email: " TEST@EXAMPLE.COM ", interest: "CRM" });
    expect(result.success).toBe(true);
    expect(result.data.email).toBe("test@example.com");
  });

  it("rebutja obligatoris i opcions desconegudes", () => {
    expect(validateDynamicForm(fields, { email: "", interest: "Altres" })).toMatchObject({
      success: false,
      errors: { email: "Correu és obligatori", interest: "Opció no vàlida" },
    });
  });
});
