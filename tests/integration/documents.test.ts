import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { convertQuoteToInvoice, recordPayment, sendInvoice } from "@/modules/documents/invoices";
import { invoicePdfByToken, quotePdfByToken } from "@/modules/documents/pdf";
import { createQuote, decideQuote, markQuoteViewed, sendQuote } from "@/modules/documents/quotes";
import { createTestFixture, removeFixture } from "./helpers";

describe("cicle de pressupost, factura i pagament", () => {
  let fixture: Awaited<ReturnType<typeof createTestFixture>>;
  let quoteId: string;
  let publicToken: string;
  let invoiceId: string;

  beforeAll(async () => { fixture = await createTestFixture("docs"); });
  afterAll(async () => removeFixture(fixture.organization.id, fixture.user.id));

  it("crea un pressupost amb número únic i totals de servidor", async () => {
    const quote = await createQuote(fixture.context, {
      companyId: fixture.company.id,
      contactId: fixture.contact.id,
      opportunityId: fixture.opportunity.id,
      lines: [
        { description: "Backoffice Smart", quantity: 1, unitPriceCents: 100_000, taxRateBps: 2100 },
        { description: "Manteniment", quantity: 2, unitPriceCents: 5_000, discountBps: 1000, taxRateBps: 2100 },
      ],
    });
    quoteId = quote.id;
    publicToken = quote.publicToken;
    expect(quote.number).toMatch(/^P-\d{4}-0001$/);
    expect(quote.items).toHaveLength(2);
    expect(quote.totalCents).toBe(131_890);
  });

  it("envia, programa seguiments i mou a proposta enviada", async () => {
    const sent = await sendQuote(fixture.context, quoteId);
    expect(sent.status).toBe("SENT");
    expect((await quotePdfByToken(publicToken)).subarray(0, 4).toString()).toBe("%PDF");
    expect(await db.emailMessage.count({ where: { quoteId, templateKey: "quote.sent" } })).toBe(1);
    expect(await db.scheduledJob.count({ where: { quoteId, status: "PENDING" } })).toBeGreaterThanOrEqual(4);
    expect(await db.opportunity.findUnique({ where: { id: fixture.opportunity.id } })).toMatchObject({ stageId: fixture.stages[1].id });
  });

  it("marca vist, accepta, cancel·la seguiments i guanya l’oportunitat", async () => {
    await markQuoteViewed(publicToken);
    expect(await db.quote.findUnique({ where: { id: quoteId } })).toMatchObject({ status: "VIEWED" });
    await decideQuote(publicToken, "accept", "Endavant");
    expect(await db.quote.findUnique({ where: { id: quoteId } })).toMatchObject({ status: "ACCEPTED", decisionComment: "Endavant" });
    expect(await db.scheduledJob.count({ where: { quoteId, status: "PENDING", type: { in: ["QUOTE_REMINDER", "QUOTE_EXPIRE"] } } })).toBe(0);
    expect(await db.opportunity.findUnique({ where: { id: fixture.opportunity.id } })).toMatchObject({ status: "WON", stageId: fixture.stages[2].id });
  });

  it("converteix en factura copiant línies i programa recordatoris en enviar", async () => {
    const invoice = await convertQuoteToInvoice(fixture.context, quoteId);
    invoiceId = invoice.id;
    expect(invoice.number).toMatch(/^F-\d{4}-0001$/);
    expect(invoice.items).toHaveLength(2);
    expect(invoice.totalCents).toBe(131_890);
    const sent = await sendInvoice(fixture.context, invoice.id);
    expect(sent.status).toBe("SENT");
    expect((await invoicePdfByToken(invoice.publicToken)).subarray(0, 4).toString()).toBe("%PDF");
    expect(await db.scheduledJob.count({ where: { invoiceId: invoice.id, status: "PENDING", type: { in: ["INVOICE_REMINDER", "INVOICE_OVERDUE"] } } })).toBeGreaterThanOrEqual(4);
  });

  it("registra un pagament idempotent, paga la factura i conserva una sola fila", async () => {
    const invoice = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const input = { organizationId: fixture.organization.id, invoiceId, amountCents: invoice.remainingAmountCents, currency: invoice.currency, method: "STRIPE" as const, idempotencyKey: `pi_test_${invoiceId}`, externalPaymentId: `pi_test_${invoiceId}`, stripePaymentIntentId: `pi_test_${invoiceId}` };
    const first = await recordPayment(input);
    const second = await recordPayment(input);
    expect(second.id).toBe(first.id);
    expect(await db.payment.count({ where: { invoiceId } })).toBe(1);
    expect(await db.invoice.findUnique({ where: { id: invoiceId } })).toMatchObject({ status: "PAID", remainingAmountCents: 0 });
    expect(await db.outboxEvent.count({ where: { aggregateId: invoiceId, eventType: "invoice.paid" } })).toBe(1);
  });

  it("genera números correlatius sota concurrència", async () => {
    const quotes = await Promise.all(Array.from({ length: 5 }, (_, index) => createQuote(fixture.context, { companyId: fixture.company.id, lines: [{ description: `Servei ${index}`, quantity: 1, unitPriceCents: 1_000, taxRateBps: 2100 }] })));
    const values = quotes.map((quote) => Number(quote.number.split("-").at(-1)));
    expect(new Set(values).size).toBe(5);
    expect(values.toSorted((a, b) => a - b)).toEqual([2, 3, 4, 5, 6]);
  });
});
