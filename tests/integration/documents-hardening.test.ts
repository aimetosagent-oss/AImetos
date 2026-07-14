import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  createInvoice,
  markInvoiceOverdue,
  recordPayment,
  sendInvoice,
} from "@/modules/documents/invoices";
import {
  createQuote,
  decideQuote,
  markQuoteViewed,
  sendQuote,
} from "@/modules/documents/quotes";
import { createTestFixture, removeFixture } from "./helpers";

describe("document concurrency and tenant invariants", () => {
  let fixture: Awaited<ReturnType<typeof createTestFixture>>;
  let foreignFixture: Awaited<ReturnType<typeof createTestFixture>>;

  beforeAll(async () => {
    fixture = await createTestFixture("docs-hardening");
    foreignFixture = await createTestFixture("docs-foreign");
  });

  afterAll(async () => {
    await removeFixture(fixture.organization.id, fixture.user.id);
    await removeFixture(foreignFixture.organization.id, foreignFixture.user.id);
  });

  it("rejects foreign products and mismatched company relations", async () => {
    const foreignProduct = await db.product.create({
      data: {
        organizationId: foreignFixture.organization.id,
        name: "Producte extern",
        sku: `foreign-${Date.now()}`,
        unitPriceCents: 1_000,
      },
    });
    const otherCompany = await db.company.create({
      data: { organizationId: fixture.organization.id, name: "Altra empresa" },
    });

    await expect(
      createQuote(fixture.context, {
        companyId: fixture.company.id,
        lines: [{ description: "No autoritzat", quantity: 1, unitPriceCents: 1_000, productId: foreignProduct.id }],
      }),
    ).rejects.toMatchObject({ code: "INVALID_PRODUCT" });

    await expect(
      createInvoice(fixture.context, {
        companyId: otherCompany.id,
        contactId: fixture.contact.id,
        lines: [{ description: "Empresa incorrecta", quantity: 1, unitPriceCents: 1_000 }],
      }),
    ).rejects.toMatchObject({ code: "CONTACT_COMPANY_MISMATCH" });

    await expect(
      createQuote(fixture.context, {
        companyId: otherCompany.id,
        opportunityId: fixture.opportunity.id,
        lines: [{ description: "Oportunitat incorrecta", quantity: 1, unitPriceCents: 1_000 }],
      }),
    ).rejects.toMatchObject({ code: "OPPORTUNITY_COMPANY_MISMATCH" });
  });

  it("records a concurrent first view exactly once and allows only one decision", async () => {
    const quote = await createQuote(fixture.context, {
      companyId: fixture.company.id,
      contactId: fixture.contact.id,
      opportunityId: fixture.opportunity.id,
      lines: [{ description: "Servei concurrent", quantity: 1, unitPriceCents: 10_000 }],
    });
    await sendQuote(fixture.context, quote.id);

    const views = await Promise.all(
      Array.from({ length: 8 }, () => markQuoteViewed(quote.publicToken)),
    );
    expect(views.every((view) => view.viewedAt !== null)).toBe(true);
    expect(await db.activity.count({ where: { quoteId: quote.id, type: "QUOTE_VIEWED" } })).toBe(1);
    expect(await db.outboxEvent.count({ where: { aggregateId: quote.id, eventType: "quote.viewed" } })).toBe(1);

    const decisions = await Promise.allSettled([
      decideQuote(quote.publicToken, "accept", "Acceptat"),
      decideQuote(quote.publicToken, "reject", "Rebutjat"),
    ]);
    expect(decisions.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(decisions.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rejected = decisions.find((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(rejected?.reason).toBeInstanceOf(AppError);
    expect(rejected?.reason).toMatchObject({ code: "INVALID_QUOTE_STATE" });

    const stored = await db.quote.findUniqueOrThrow({ where: { id: quote.id } });
    const decisionActivityCount = await db.activity.count({
      where: { quoteId: quote.id, type: { in: ["QUOTE_ACCEPTED", "QUOTE_REJECTED"] } },
    });
    const decisionOutboxCount = await db.outboxEvent.count({
      where: { aggregateId: quote.id, eventType: { in: ["quote.accepted", "quote.rejected"] } },
    });
    expect(decisionActivityCount).toBe(1);
    expect(decisionOutboxCount).toBe(1);

    const opportunity = await db.opportunity.findUniqueOrThrow({ where: { id: fixture.opportunity.id } });
    const wonTransitions = await db.opportunityStageHistory.count({
      where: { opportunityId: fixture.opportunity.id, toStageId: fixture.stages[2].id },
    });
    if (stored.status === "ACCEPTED") {
      expect(opportunity).toMatchObject({ status: "WON", stageId: fixture.stages[2].id });
      expect(wonTransitions).toBe(1);
    } else {
      expect(stored.status).toBe("REJECTED");
      expect(opportunity).toMatchObject({ status: "OPEN", stageId: fixture.stages[1].id });
      expect(wonTransitions).toBe(0);
    }
  });

  it("serializes concurrent payments and derives the final balance from payment rows", async () => {
    const invoice = await createInvoice(fixture.context, {
      companyId: fixture.company.id,
      contactId: fixture.contact.id,
      lines: [{ description: "Factura concurrent", quantity: 1, unitPriceCents: 10_000 }],
    });
    await sendInvoice(fixture.context, invoice.id);

    await Promise.all([
      recordPayment({
        organizationId: fixture.organization.id,
        invoiceId: invoice.id,
        amountCents: 4_000,
        currency: invoice.currency,
        method: "MANUAL",
        idempotencyKey: `manual:${invoice.id}:part-1`,
        recordedById: fixture.user.id,
      }),
      recordPayment({
        organizationId: fixture.organization.id,
        invoiceId: invoice.id,
        amountCents: 6_000,
        currency: invoice.currency,
        method: "MANUAL",
        idempotencyKey: `manual:${invoice.id}:part-2`,
        recordedById: fixture.user.id,
      }),
    ]);

    expect(await db.payment.count({ where: { invoiceId: invoice.id } })).toBe(2);
    expect(await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).toMatchObject({
      paidAmountCents: 10_000,
      remainingAmountCents: 0,
      status: "PAID",
    });
    expect(await db.outboxEvent.count({ where: { aggregateId: invoice.id, eventType: "invoice.paid" } })).toBe(1);
    expect(await db.emailMessage.count({ where: { invoiceId: invoice.id, templateKey: "invoice.payment_received" } })).toBe(1);
  });

  it("keeps a partially paid past-due invoice overdue and replays one payment idempotently", async () => {
    const invoice = await createInvoice(fixture.context, {
      companyId: fixture.company.id,
      contactId: fixture.contact.id,
      dueDate: new Date(Date.now() - 2 * 86_400_000),
      lines: [{ description: "Factura vençuda", quantity: 1, unitPriceCents: 10_000 }],
    });
    await sendInvoice(fixture.context, invoice.id);
    await markInvoiceOverdue(fixture.organization.id, invoice.id);
    const input = {
      organizationId: fixture.organization.id,
      invoiceId: invoice.id,
      amountCents: 2_500,
      currency: invoice.currency,
      method: "MANUAL" as const,
      idempotencyKey: `manual:${invoice.id}:stable-request`,
      recordedById: fixture.user.id,
    };

    const payments = await Promise.all(Array.from({ length: 6 }, () => recordPayment(input)));
    expect(new Set(payments.map((payment) => payment.id)).size).toBe(1);
    expect(await db.payment.count({ where: { invoiceId: invoice.id } })).toBe(1);
    expect(await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).toMatchObject({
      paidAmountCents: 2_500,
      remainingAmountCents: 7_500,
      status: "OVERDUE",
    });
  });
});
