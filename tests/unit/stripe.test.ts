import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ storedEvent: null as Record<string, unknown> | null }));
const mocks = vi.hoisted(() => ({
  invoiceFindUnique: vi.fn(),
  invoiceFindFirst: vi.fn(),
  invoiceFindMany: vi.fn(),
  invoiceUpdateMany: vi.fn(),
  companyFindFirst: vi.fn(),
  companyUpdateMany: vi.fn(),
  paymentFindFirst: vi.fn(),
  stripeEventFindUnique: vi.fn(),
  stripeEventFindUniqueOrThrow: vi.fn(),
  stripeEventCreate: vi.fn(),
  stripeEventUpdateMany: vi.fn(),
  stripeEventUpdate: vi.fn(),
  recordPayment: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    invoice: {
      findUnique: mocks.invoiceFindUnique,
      findFirst: mocks.invoiceFindFirst,
      findMany: mocks.invoiceFindMany,
      updateMany: mocks.invoiceUpdateMany,
    },
    company: { findFirst: mocks.companyFindFirst, updateMany: mocks.companyUpdateMany },
    payment: { findFirst: mocks.paymentFindFirst },
    stripeEvent: {
      findUnique: mocks.stripeEventFindUnique,
      findUniqueOrThrow: mocks.stripeEventFindUniqueOrThrow,
      create: mocks.stripeEventCreate,
      updateMany: mocks.stripeEventUpdateMany,
      update: mocks.stripeEventUpdate,
    },
  },
}));

vi.mock("@/modules/documents/invoices", () => ({ recordPayment: mocks.recordPayment }));

import {
  constructStripeWebhookEvent,
  createPublicInvoiceCheckoutSession,
  processStripeEvent,
  stripePaymentIdempotencyKey,
  stripeSecretMode,
} from "@/modules/integrations/stripe";
import { stripeTestConfigurationIsComplete } from "@/lib/env";

const originalEnvironment = {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
};

describe("Stripe test-mode guard", () => {
  it("classifies test, live, missing and malformed keys", () => {
    expect(stripeSecretMode(undefined)).toBe("missing");
    expect(stripeSecretMode("sk_test_example")).toBe("test");
    expect(stripeSecretMode("sk_live_example")).toBe("live");
    expect(stripeSecretMode("rk_live_example")).toBe("live");
    expect(stripeSecretMode("not-a-key")).toBe("invalid");
  });

  it("requires the complete test-mode key set", () => {
    expect(
      stripeTestConfigurationIsComplete({
        STRIPE_SECRET_KEY: "sk_test_unit",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_unit",
        STRIPE_WEBHOOK_SECRET: "whsec_unit",
      }),
    ).toBe(true);
    expect(
      stripeTestConfigurationIsComplete({
        STRIPE_SECRET_KEY: "sk_test_unit",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: undefined,
        STRIPE_WEBHOOK_SECRET: "whsec_unit",
      }),
    ).toBe(false);
    expect(
      stripeTestConfigurationIsComplete({
        STRIPE_SECRET_KEY: "sk_live_forbidden",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_forbidden",
        STRIPE_WEBHOOK_SECRET: "whsec_unit",
      }),
    ).toBe(false);
  });

  it("hard-blocks a live secret before signature processing", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_forbidden";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_unit";
    expect(() => constructStripeWebhookEvent("{}", "t=1,v1=bad")).toThrowError(
      expect.objectContaining({ code: "STRIPE_LIVE_MODE_FORBIDDEN" }),
    );
  });

  it("verifies the untouched raw body", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_unit";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_unit";
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_unit";
    const payload = JSON.stringify({ id: "evt_signed", object: "event", livemode: false, type: "test.event", data: { object: {} } });
    const stripe = new Stripe("sk_test_unit");
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_unit" });

    expect(constructStripeWebhookEvent(payload, signature).id).toBe("evt_signed");
    expect(() => constructStripeWebhookEvent(`${payload} `, signature)).toThrowError(
      expect.objectContaining({ code: "STRIPE_INVALID_SIGNATURE" }),
    );
  });
});

describe("public invoice checkout capability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a short token without looking up an invoice", async () => {
    await expect(createPublicInvoiceCheckoutSession("invoice_1", "too-short")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.invoiceFindUnique).not.toHaveBeenCalled();
  });

  it("discovers the invoice only by token and cross-checks the route ID", async () => {
    const publicToken = "a".repeat(43);
    mocks.invoiceFindUnique.mockResolvedValue({ id: "another_invoice" });

    await expect(createPublicInvoiceCheckoutSession("invoice_1", publicToken)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.invoiceFindUnique).toHaveBeenCalledWith({
      where: { publicToken },
      include: {
        company: true,
        contact: true,
        organization: { select: { settings: { select: { stripeEnabled: true, stripeTestMode: true } } } },
      },
    });
    expect(mocks.invoiceFindFirst).not.toHaveBeenCalled();
  });

  it("requires the organization to enable test-mode Checkout", async () => {
    const publicToken = "b".repeat(43);
    mocks.invoiceFindUnique.mockResolvedValue({
      id: "invoice_1",
      organization: { settings: { stripeEnabled: false, stripeTestMode: true } },
    });

    await expect(createPublicInvoiceCheckoutSession("invoice_1", publicToken)).rejects.toMatchObject({ code: "STRIPE_DISABLED" });
  });

  it("rejects organization settings that attempt non-test Checkout", async () => {
    const publicToken = "c".repeat(43);
    mocks.invoiceFindUnique.mockResolvedValue({
      id: "invoice_1",
      organization: { settings: { stripeEnabled: true, stripeTestMode: false } },
    });

    await expect(createPublicInvoiceCheckoutSession("invoice_1", publicToken)).rejects.toMatchObject({
      code: "STRIPE_LIVE_MODE_FORBIDDEN",
    });
  });

  it("requires all three configured test keys before Checkout", async () => {
    const publicToken = "d".repeat(43);
    mocks.invoiceFindUnique.mockResolvedValue({
      id: "invoice_1",
      organization: { settings: { stripeEnabled: true, stripeTestMode: true } },
    });
    process.env.STRIPE_SECRET_KEY = "sk_test_unit";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_unit";
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    await expect(createPublicInvoiceCheckoutSession("invoice_1", publicToken)).rejects.toMatchObject({ code: "STRIPE_NOT_CONFIGURED" });
  });
});

describe("unowned Stripe events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invoiceFindMany.mockResolvedValue([]);
  });

  it("acknowledges an unrelated handled event without persisting it or triggering retries", async () => {
    const event = {
      id: "evt_unowned",
      object: "event",
      api_version: null,
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_unowned",
          object: "payment_intent",
          amount: 1_000,
          currency: "eur",
          metadata: {},
        },
      },
    } as unknown as Stripe.Event;

    await expect(processStripeEvent(event)).resolves.toEqual({
      eventId: "evt_unowned",
      status: "IGNORED",
      reason: "unowned_handled_event",
      duplicate: false,
      persisted: false,
    });
    expect(mocks.stripeEventCreate).not.toHaveBeenCalled();
  });
});

describe("Stripe payment idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.storedEvent = null;
    mocks.invoiceFindUnique.mockResolvedValue({
      id: "invoice_1",
      organizationId: "org_1",
      companyId: "company_1",
      contactId: null,
      opportunityId: null,
    });
    mocks.invoiceFindFirst.mockResolvedValue({ id: "invoice_1", currency: "EUR" });
    mocks.invoiceUpdateMany.mockResolvedValue({ count: 1 });
    mocks.companyFindFirst.mockResolvedValue({ stripeCustomerId: "cus_123" });
    mocks.companyUpdateMany.mockResolvedValue({ count: 1 });
    mocks.paymentFindFirst.mockResolvedValue(null);
    mocks.recordPayment.mockResolvedValue({ id: "payment_1" });
    mocks.stripeEventFindUnique.mockImplementation(async () => state.storedEvent);
    mocks.stripeEventCreate.mockImplementation(async ({ data }) => {
      state.storedEvent = {
        id: "stored_event_1",
        status: "PENDING",
        invoiceId: null,
        paymentId: null,
        stripeSubscriptionId: null,
        updatedAt: new Date(),
        ...data,
      };
      return state.storedEvent;
    });
    mocks.stripeEventFindUniqueOrThrow.mockImplementation(async () => state.storedEvent);
    mocks.stripeEventUpdateMany.mockImplementation(async ({ where, data }) => {
      if (!state.storedEvent || state.storedEvent.status !== where.status) return { count: 0 };
      state.storedEvent = {
        ...state.storedEvent,
        status: data.status,
        attempts: Number(state.storedEvent.attempts ?? 0) + 1,
        updatedAt: new Date(),
      };
      return { count: 1 };
    });
    mocks.stripeEventUpdate.mockImplementation(async ({ data }) => {
      state.storedEvent = { ...state.storedEvent, ...data, updatedAt: new Date() };
      return state.storedEvent;
    });
  });

  it("uses one semantic key for every event describing a PaymentIntent", () => {
    expect(stripePaymentIdempotencyKey("pi_123", "cs_123")).toBe("stripe:payment_intent:pi_123");
    expect(stripePaymentIdempotencyKey(undefined, "cs_123")).toBe("stripe:payment:cs_123");
  });

  it("does not record a payment twice across retries or related Stripe event types", async () => {
    const event = {
      id: "evt_payment_succeeded",
      object: "event",
      api_version: null,
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_123",
          object: "payment_intent",
          amount: 2_500,
          amount_received: 2_500,
          currency: "eur",
          customer: "cus_123",
          metadata: { aimetosOrganizationId: "org_1", aimetosInvoiceId: "invoice_1" },
        },
      },
    } as unknown as Stripe.Event;

    const first = await processStripeEvent(event);
    const duplicate = await processStripeEvent(event);

    state.storedEvent = null;
    mocks.paymentFindFirst.mockResolvedValue({ id: "payment_1" });
    const checkoutEvent = {
      ...event,
      id: "evt_checkout_completed",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          object: "checkout.session",
          amount_total: 2_500,
          currency: "eur",
          customer: "cus_123",
          payment_intent: "pi_123",
          payment_status: "paid",
          metadata: { aimetosOrganizationId: "org_1", aimetosInvoiceId: "invoice_1" },
        },
      },
    } as unknown as Stripe.Event;
    const related = await processStripeEvent(checkoutEvent);

    expect(first).toMatchObject({ status: "PROCESSED", duplicate: false, paymentId: "payment_1" });
    expect(duplicate).toMatchObject({ status: "PROCESSED", duplicate: true, paymentId: "payment_1" });
    expect(related).toMatchObject({ status: "PROCESSED", duplicate: false, paymentId: "payment_1" });
    expect(mocks.recordPayment).toHaveBeenCalledTimes(1);
    expect(mocks.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        invoiceId: "invoice_1",
        amountCents: 2_500,
        currency: "EUR",
        method: "STRIPE",
        idempotencyKey: "stripe:payment_intent:pi_123",
        stripePaymentIntentId: "pi_123",
      }),
    );
  });

  it("rejects a mismatched Stripe customer before writing invoice links", async () => {
    mocks.companyFindFirst.mockResolvedValue({ stripeCustomerId: "cus_expected" });
    const event = {
      id: "evt_wrong_customer",
      object: "event",
      api_version: null,
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_wrong_customer",
          object: "payment_intent",
          amount: 2_500,
          amount_received: 2_500,
          currency: "eur",
          customer: "cus_wrong",
          metadata: { aimetosOrganizationId: "org_1", aimetosInvoiceId: "invoice_1" },
        },
      },
    } as unknown as Stripe.Event;

    await expect(processStripeEvent(event)).rejects.toMatchObject({ code: "STRIPE_CUSTOMER_MISMATCH" });
    expect(mocks.invoiceUpdateMany).not.toHaveBeenCalled();
    expect(mocks.recordPayment).not.toHaveBeenCalled();
    expect(state.storedEvent).toMatchObject({ status: "FAILED" });
  });

  it("does not invent a Stripe payment for an invoice paid out of band", async () => {
    const event = {
      id: "evt_invoice_out_of_band",
      object: "event",
      api_version: null,
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      type: "invoice.paid",
      data: {
        object: {
          id: "in_out_of_band",
          object: "invoice",
          amount_paid: 2_500,
          amount_paid_off_stripe: 2_500,
          currency: "eur",
          customer: "cus_123",
          metadata: { aimetosOrganizationId: "org_1", aimetosInvoiceId: "invoice_1" },
        },
      },
    } as unknown as Stripe.Event;

    await expect(processStripeEvent(event)).resolves.toMatchObject({ status: "PROCESSED", invoiceId: "invoice_1" });
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });

  it("records the latest paid InvoicePayment amount instead of cumulative invoice.amount_paid", async () => {
    const event = {
      id: "evt_invoice_paid",
      object: "event",
      api_version: null,
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      type: "invoice.paid",
      data: {
        object: {
          id: "in_paid",
          object: "invoice",
          amount_paid: 2_500,
          amount_paid_off_stripe: 0,
          currency: "eur",
          customer: "cus_123",
          metadata: { aimetosOrganizationId: "org_1", aimetosInvoiceId: "invoice_1" },
          payments: {
            data: [
              {
                id: "inpay_older",
                status: "paid",
                amount_paid: 1_500,
                currency: "eur",
                created: 100,
                payment: { type: "payment_intent", payment_intent: "pi_older" },
              },
              {
                id: "inpay_latest",
                status: "paid",
                amount_paid: 1_000,
                currency: "eur",
                created: 200,
                payment: { type: "payment_intent", payment_intent: "pi_latest" },
              },
            ],
          },
        },
      },
    } as unknown as Stripe.Event;

    await expect(processStripeEvent(event)).resolves.toMatchObject({ status: "PROCESSED", paymentId: "payment_1" });
    expect(mocks.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: "invoice_1",
        amountCents: 1_000,
        currency: "EUR",
        idempotencyKey: "stripe:payment_intent:pi_latest",
        externalPaymentId: "pi_latest",
      }),
    );
  });
});

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
