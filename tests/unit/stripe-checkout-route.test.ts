import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createInvoiceCheckoutSession: vi.fn(),
  createPublicInvoiceCheckoutSession: vi.fn(),
  requireTenant: vi.fn(),
}));

vi.mock("@/modules/integrations/stripe", () => ({
  createInvoiceCheckoutSession: mocks.createInvoiceCheckoutSession,
  createPublicInvoiceCheckoutSession: mocks.createPublicInvoiceCheckoutSession,
}));

vi.mock("@/lib/tenant", () => ({ requireTenant: mocks.requireTenant }));

import { POST } from "@/app/api/invoices/[id]/checkout/route";

const tenant = { organizationId: "org_1", userId: "user_1", role: "ADMIN" as const };

describe("invoice Checkout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTenant.mockResolvedValue(tenant);
  });

  it("uses a posted public capability without requiring a tenant session and redirects HTML forms", async () => {
    const publicToken = "a".repeat(43);
    mocks.createPublicInvoiceCheckoutSession.mockResolvedValue({
      id: "cs_public",
      url: "https://checkout.stripe.test/cs_public",
      reused: false,
    });
    const request = new Request("http://localhost/api/invoices/invoice_1/checkout", {
      method: "POST",
      headers: { accept: "text/html,application/xhtml+xml", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ publicToken }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "invoice_1" }) });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://checkout.stripe.test/cs_public");
    expect(mocks.createPublicInvoiceCheckoutSession).toHaveBeenCalledWith("invoice_1", publicToken);
    expect(mocks.requireTenant).not.toHaveBeenCalled();
    expect(mocks.createInvoiceCheckoutSession).not.toHaveBeenCalled();
  });

  it("keeps authenticated tenant checkout and returns JSON only when requested", async () => {
    mocks.createInvoiceCheckoutSession.mockResolvedValue({
      id: "cs_tenant",
      url: "https://checkout.stripe.test/cs_tenant",
      reused: true,
    });
    const request = new Request("http://localhost/api/invoices/invoice_1/checkout", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: "{}",
    });

    const response = await POST(request, { params: Promise.resolve({ id: "invoice_1" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      checkout: { id: "cs_tenant", url: "https://checkout.stripe.test/cs_tenant", reused: true },
    });
    expect(mocks.requireTenant).toHaveBeenCalledOnce();
    expect(mocks.createInvoiceCheckoutSession).toHaveBeenCalledWith(tenant, "invoice_1");
    expect(mocks.createPublicInvoiceCheckoutSession).not.toHaveBeenCalled();
  });
});
