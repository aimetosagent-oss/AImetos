import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createTestFixture, removeFixture } from "./helpers";

const mocks = vi.hoisted(() => ({ requireTenant: vi.fn() }));
vi.mock("@/lib/tenant", () => mocks);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/auth", () => ({ signOut: vi.fn() }));
import { updateCommercialRecordAction, rescheduleTaskAction } from "@/app/(crm)/actions";
import { sendInvoice } from "@/modules/documents/invoices";
import { createQuote } from "@/modules/documents/quotes";
import { GET as privatePdf } from "@/app/api/documents/[type]/[id]/pdf/route";

describe("commercial edit isolation", () => {
  let a: Awaited<ReturnType<typeof createTestFixture>>;
  let b: typeof a;
  beforeAll(async () => { a = await createTestFixture("edit-a"); b = await createTestFixture("edit-b"); mocks.requireTenant.mockResolvedValue(a.context); });
  afterAll(async () => { await removeFixture(a.organization.id, a.user.id); await removeFixture(b.organization.id, b.user.id); });
  it("edits the current organisation and records an audit", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ type: "companies", id: a.company.id, name: "Updated commercial company", country: "ES" })) form.set(key, value);
    await expect(updateCommercialRecordAction(form)).rejects.toThrow(`redirect:/companies/${a.company.id}`);
    expect((await db.company.findUnique({ where: { id: a.company.id } }))?.name).toBe("Updated commercial company");
    expect(await db.auditLog.count({ where: { organizationId: a.organization.id, entityId: a.company.id, action: "RECORD_UPDATED" } })).toBe(1);
  });
  it("rejects a record from a different organisation", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ type: "companies", id: b.company.id, name: "Unauthorized edit", country: "ES" })) form.set(key, value);
    await expect(updateCommercialRecordAction(form)).rejects.toThrow("redirect:/companies?");
    expect((await db.company.findUnique({ where: { id: b.company.id } }))?.name).toBe(b.company.name);
  });
  it("edits a contact and preserves the company link", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ type: "contacts", id: a.contact.id, firstName: "Edited contact", preferredLanguage: "ca", companyId: a.company.id })) form.set(key, value);
    await expect(updateCommercialRecordAction(form)).rejects.toThrow(`redirect:/contacts/${a.contact.id}`);
    expect(await db.contact.findUnique({ where: { id: a.contact.id } })).toMatchObject({ firstName: "Edited contact", companyId: a.company.id });
  });
  it("edits an opportunity without bypassing the stage transition service", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ type: "opportunities", id: a.opportunity.id, title: "Edited opportunity", value: "1750", recurringAmount: "190", recurringInterval: "MONTHLY", serviceStartDate: "2027-01-15", currency: "EUR", probability: "50", ownerId: a.user.id })) form.set(key, value);
    await expect(updateCommercialRecordAction(form)).rejects.toThrow(`redirect:/pipeline/${a.opportunity.id}`);
    expect(await db.opportunity.findUnique({ where: { id: a.opportunity.id } })).toMatchObject({ title: "Edited opportunity", valueCents: 175000, recurringAmountCents: 19000, recurringInterval: "MONTHLY", serviceStartDate: new Date("2027-01-15"), stageId: a.opportunity.stageId });
  });
  it("rejects a company relation from another organisation", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ type: "contacts", id: a.contact.id, firstName: "Invalid relation", preferredLanguage: "ca", companyId: b.company.id })) form.set(key, value);
    await expect(updateCommercialRecordAction(form)).rejects.toThrow(`/edit/contacts/${a.contact.id}?error=`);
    expect((await db.contact.findUnique({ where: { id: a.contact.id } }))?.companyId).toBe(a.company.id);
  });
  it("reschedules the task and its existing job without duplicate reminders", async () => {
    const task = await db.task.create({ data: { organizationId: a.organization.id, title: "Call", createdById: a.user.id, assignedToId: a.user.id } });
    const form = new FormData();
    for (const [key, value] of Object.entries({ taskId: task.id, title: "Call tomorrow", dueAt: "2027-01-16T09:30:00Z", assignedToId: a.user.id })) form.set(key, value);
    await expect(rescheduleTaskAction(form)).rejects.toThrow("redirect:/tasks?updated=1");
    form.set("dueAt", "2027-01-17T09:30:00Z");
    await expect(rescheduleTaskAction(form)).rejects.toThrow("redirect:/tasks?updated=1");
    expect(await db.scheduledJob.count({ where: { taskId: task.id } })).toBe(1);
    expect((await db.task.findUnique({ where: { id: task.id } }))?.dueAt).toEqual(new Date("2027-01-17T09:30:00Z"));
  });
  it("keeps draft PDFs private and prevents cross-organisation access", async () => {
    const quote = await createQuote(a.context, { companyId: a.company.id, lines: [{ description: "Private draft", quantity: 1, unitPriceCents: 10000, taxRateBps: 2100, discountBps: 1000 }] });
    const request = new Request("http://localhost/api/documents/quotes/pdf");
    const response = await privatePdf(request, { params: Promise.resolve({ type: "quotes", id: quote.id }) });
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 4).toString()).toBe("%PDF");
    mocks.requireTenant.mockResolvedValueOnce(b.context);
    expect((await privatePdf(request, { params: Promise.resolve({ type: "quotes", id: quote.id }) })).status).toBe(404);
    expect((await db.quote.findUnique({ where: { id: quote.id } }))?.status).toBe("DRAFT");
  });
  it("refuses fiscal issuance in production until explicitly enabled", async () => {
    vi.stubEnv("PRODUCTION_DEPLOYMENT", "true"); vi.stubEnv("FISCAL_INVOICING_ENABLED", "false");
    try { await expect(sendInvoice(a.context, "not-issued")).rejects.toMatchObject({ code: "FISCAL_ISSUANCE_DISABLED" }); }
    finally { vi.unstubAllEnvs(); }
  });
});
