import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoiceFindUnique: vi.fn(),
  invoiceFindFirst: vi.fn(),
  invoiceUpdateMany: vi.fn(),
  companyFindFirst: vi.fn(),
  companyUpdateMany: vi.fn(),
  customerCreate: vi.fn(),
  sessionCreate: vi.fn(),
  sessionRetrieve: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class FakeStripe {
    customers = { create: mocks.customerCreate };
    checkout = { sessions: { create: mocks.sessionCreate, retrieve: mocks.sessionRetrieve } };
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    invoice: {
      findUnique: mocks.invoiceFindUnique,
      findFirst: mocks.invoiceFindFirst,
      updateMany: mocks.invoiceUpdateMany,
    },
    company: {
      findFirst: mocks.companyFindFirst,
      updateMany: mocks.companyUpdateMany,
    },
  },
}));

vi.mock("@/modules/documents/invoices", () => ({ recordPayment: vi.fn() }));

import { createPublicInvoiceCheckoutSession } from "@/modules/integrations/stripe";

const originalEnvironment = {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
};

describe("Stripe Checkout service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_unit";
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_unit";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_unit";
    mocks.invoiceUpdateMany.mockResolvedValue({ count: 1 });
    mocks.sessionCreate.mockResolvedValue({
      id: "cs_test_1",
      url: "https://checkout.stripe.test/cs_test_1",
      payment_intent: "pi_test_1",
    });
  });

  it("persists a reused Company customer ID on the Invoice before creating Checkout", async () => {
    const publicToken = "p".repeat(43);
    mocks.invoiceFindUnique.mockResolvedValue({
      id: "invoice_1",
      organizationId: "org_1",
      number: "F-2026-0001",
      status: "SENT",
      companyId: "company_1",
      contactId: null,
      opportunityId: null,
      currency: "EUR",
      remainingAmountCents: 2_500,
      publicToken,
      stripeCustomerId: null,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      company: {
        name: "Client demo",
        emailNormalized: "client@example.test",
        stripeCustomerId: "cus_existing",
      },
      contact: null,
      organization: { settings: { stripeEnabled: true, stripeTestMode: true } },
    });

    await expect(createPublicInvoiceCheckoutSession("invoice_1", publicToken)).resolves.toEqual({
      id: "cs_test_1",
      url: "https://checkout.stripe.test/cs_test_1",
      reused: false,
    });

    expect(mocks.customerCreate).not.toHaveBeenCalled();
    expect(mocks.invoiceUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "invoice_1", organizationId: "org_1", stripeCustomerId: null },
      data: { stripeCustomerId: "cus_existing" },
    });
    expect(mocks.invoiceUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "invoice_1", organizationId: "org_1" },
      data: {
        stripeCustomerId: "cus_existing",
        stripeCheckoutSessionId: "cs_test_1",
        stripePaymentIntentId: "pi_test_1",
      },
    });
  });
});

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
