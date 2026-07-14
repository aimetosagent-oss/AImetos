import { Prisma, type Payment } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError, NotFoundError } from "@/lib/errors";
import { publicToken } from "@/lib/tokens";
import type { TenantContext } from "@/lib/tenant";
import { createOutboxEvent } from "@/modules/automation/outbox";
import { invoiceSentTemplate, paymentConfirmationTemplate } from "@/modules/communications/templates";
import { moveOpportunityInTransaction } from "@/modules/pipeline/service";
import { calculateDocumentLines, type DocumentLineInput } from "./calculation";
import { nextDocumentNumber } from "./numbering";
import { documentTransaction } from "./transactions";
import { validateDocumentReferences } from "./validation";

export type CreateInvoiceInput = {
  companyId: string;
  contactId?: string | null;
  opportunityId?: string | null;
  issueDate?: Date;
  dueDate?: Date;
  currency?: string;
  notes?: string | null;
  terms?: string | null;
  lines: DocumentLineInput[];
};

export async function createInvoice(context: TenantContext, input: CreateInvoiceInput) {
  const totals = calculateDocumentLines(input.lines);
  const issueDate = input.issueDate ?? new Date();
  return documentTransaction(async (tx) => {
      const [{ company, contact, opportunity }, settings] = await Promise.all([
        validateDocumentReferences(tx, {
          organizationId: context.organizationId,
          companyId: input.companyId,
          contactId: input.contactId,
          opportunityId: input.opportunityId,
          lines: input.lines,
        }),
        tx.organizationSettings.findUnique({ where: { organizationId: context.organizationId } }),
      ]);
      if (!settings) throw new AppError("Falta la configuració de l’organització", "MISSING_SETTINGS", 409);
      const number = await nextDocumentNumber(tx, {
        organizationId: context.organizationId,
        type: "INVOICE",
        issueDate,
        prefix: settings.invoicePrefix,
        padding: settings.invoiceNumberLength,
      });
      const invoice = await tx.invoice.create({
        data: {
          organizationId: context.organizationId,
          number,
          companyId: company.id,
          contactId: contact?.id,
          opportunityId: opportunity?.id,
          issueDate,
          dueDate: input.dueDate ?? new Date(issueDate.getTime() + settings.invoiceDueDays * 86_400_000),
          currency: input.currency ?? settings.currency,
          subtotalCents: totals.subtotalCents,
          discountAmountCents: totals.discountAmountCents,
          taxAmountCents: totals.taxAmountCents,
          totalCents: totals.totalCents,
          remainingAmountCents: totals.totalCents,
          notesText: input.notes,
          terms: input.terms,
          publicToken: publicToken(),
          reminderOffsetsDays: settings.invoiceReminderOffsetsDays,
          createdById: context.userId,
          items: {
            create: totals.lines.map((line) => ({
              organizationId: context.organizationId,
              productId: line.productId,
              description: line.description,
              quantity: line.quantity,
              unitPriceCents: line.unitPriceCents,
              discountBps: line.discountBps,
              discountAmountCents: line.discountAmountCents,
              taxRateBps: line.taxRateBps,
              subtotalCents: line.subtotalCents,
              taxAmountCents: line.taxAmountCents,
              totalCents: line.totalCents,
              position: line.position,
            })),
          },
        },
        include: { items: true },
      });
      await recordInvoiceCreated(tx, context, invoice);
      return invoice;
  });
}

export async function convertQuoteToInvoice(context: TenantContext, quoteId: string) {
  return documentTransaction(async (tx) => {
      const quote = await tx.quote.findFirst({
        where: { id: quoteId, organizationId: context.organizationId },
        include: { items: { orderBy: { position: "asc" } }, invoice: { include: { items: { orderBy: { position: "asc" } } } } },
      });
      if (!quote) throw new NotFoundError("No s’ha trobat el pressupost");
      if (quote.invoice) return quote.invoice;
      if (quote.status !== "ACCEPTED") throw new AppError("Cal acceptar el pressupost abans de convertir-lo", "QUOTE_NOT_ACCEPTED", 409);
      const settings = await tx.organizationSettings.findUnique({ where: { organizationId: context.organizationId } });
      if (!settings) throw new AppError("Falta la configuració de l’organització", "MISSING_SETTINGS", 409);
      const issueDate = new Date();
      const number = await nextDocumentNumber(tx, {
        organizationId: context.organizationId,
        type: "INVOICE",
        issueDate,
        prefix: settings.invoicePrefix,
        padding: settings.invoiceNumberLength,
      });
      const invoice = await tx.invoice.create({
        data: {
          organizationId: context.organizationId,
          number,
          companyId: quote.companyId,
          contactId: quote.contactId,
          opportunityId: quote.opportunityId,
          quoteId: quote.id,
          issueDate,
          dueDate: new Date(issueDate.getTime() + settings.invoiceDueDays * 86_400_000),
          currency: quote.currency,
          subtotalCents: quote.subtotalCents,
          discountAmountCents: quote.discountAmountCents,
          taxAmountCents: quote.taxAmountCents,
          totalCents: quote.totalCents,
          remainingAmountCents: quote.totalCents,
          notesText: quote.notesText,
          terms: quote.terms,
          publicToken: publicToken(),
          reminderOffsetsDays: settings.invoiceReminderOffsetsDays,
          createdById: context.userId,
          items: {
            create: quote.items.map((line) => ({
              organizationId: context.organizationId,
              productId: line.productId,
              description: line.description,
              quantity: line.quantity,
              unitPriceCents: line.unitPriceCents,
              discountBps: line.discountBps,
              discountAmountCents: line.discountAmountCents,
              taxRateBps: line.taxRateBps,
              subtotalCents: line.subtotalCents,
              taxAmountCents: line.taxAmountCents,
              totalCents: line.totalCents,
              position: line.position,
            })),
          },
        },
        include: { items: true },
      });
      await tx.scheduledJob.updateMany({ where: { quoteId: quote.id, status: "PENDING" }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      await tx.quote.update({ where: { id: quote.id }, data: { followUpsCancelledAt: new Date() } });
      await recordInvoiceCreated(tx, context, invoice);
      return invoice;
  });
}

async function recordInvoiceCreated(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  invoice: { id: string; number: string; companyId: string; contactId: string | null; opportunityId: string | null; totalCents: number; currency: string },
) {
  await tx.activity.create({
    data: {
      organizationId: context.organizationId,
      type: "INVOICE_CREATED",
      summary: `Factura ${invoice.number} creada`,
      actorId: context.userId,
      invoiceId: invoice.id,
      companyId: invoice.companyId,
      contactId: invoice.contactId,
      opportunityId: invoice.opportunityId,
    },
  });
  await createOutboxEvent(tx, {
    organizationId: context.organizationId,
    eventType: "invoice.created",
    aggregateType: "Invoice",
    aggregateId: invoice.id,
    idempotencyKey: `invoice.created:${invoice.id}`,
    payload: { invoiceId: invoice.id, number: invoice.number, totalCents: invoice.totalCents, currency: invoice.currency },
  });
}

export async function sendInvoice(context: TenantContext, invoiceId: string) {
  const snapshot = await db.invoice.findFirst({
    where: { id: invoiceId, organizationId: context.organizationId },
    include: { company: true, contact: true },
  });
  if (!snapshot) throw new NotFoundError("No s’ha trobat la factura");
  if (!["DRAFT", "ISSUED"].includes(snapshot.status)) throw new AppError("Aquesta factura no es pot enviar en l’estat actual", "INVALID_INVOICE_STATE", 409);
  const recipient = snapshot.contact?.emailNormalized ?? snapshot.company.emailNormalized;
  if (!recipient) throw new AppError("El client no té cap correu electrònic", "MISSING_RECIPIENT", 422);
  const template = invoiceSentTemplate({
    clientName: snapshot.contact?.firstName ?? snapshot.company.name,
    number: snapshot.number,
    totalCents: snapshot.totalCents,
    currency: snapshot.currency,
    dueDate: snapshot.dueDate,
    url: `${env().APP_URL}/i/${snapshot.publicToken}`,
  });
  const now = new Date();
  return db.$transaction(async (tx) => {
    const changed = await tx.invoice.updateMany({
      where: { id: invoiceId, organizationId: context.organizationId, status: { in: ["DRAFT", "ISSUED"] } },
      data: { status: "SENT", issuedAt: snapshot.issuedAt ?? now, sentAt: now },
    });
    if (changed.count !== 1) throw new AppError("La factura ja s’ha enviat", "INVOICE_ALREADY_SENT", 409);
    const email = await tx.emailMessage.create({
      data: {
        organizationId: context.organizationId,
        templateKey: "invoice.sent",
        toAddress: recipient,
        ccAddresses: [],
        bccAddresses: [],
        subject: template.subject,
        htmlBody: template.html,
        textBody: template.text,
        idempotencyKey: `invoice.sent:${invoiceId}`,
        contactId: snapshot.contactId,
        invoiceId,
      },
    });
    const jobs: Prisma.ScheduledJobCreateManyInput[] = [
      { organizationId: context.organizationId, type: "EMAIL_SEND", runAt: now, payload: { emailMessageId: email.id }, emailMessageId: email.id, invoiceId, deduplicationKey: `email:${email.id}` },
      ...snapshot.reminderOffsetsDays.map((offset) => ({
        organizationId: context.organizationId,
        type: "INVOICE_REMINDER" as const,
        runAt: new Date(snapshot.dueDate.getTime() + offset * 86_400_000),
        payload: { invoiceId, offset },
        invoiceId,
        deduplicationKey: `invoice:${invoiceId}:reminder:${offset}`,
      })),
      {
        organizationId: context.organizationId,
        type: "INVOICE_OVERDUE",
        runAt: new Date(snapshot.dueDate.getTime() + 86_400_000),
        payload: { invoiceId },
        invoiceId,
        deduplicationKey: `invoice:${invoiceId}:overdue`,
      },
    ];
    await tx.scheduledJob.createMany({ data: jobs, skipDuplicates: true });
    await tx.activity.create({ data: { organizationId: context.organizationId, type: "INVOICE_SENT", summary: `Factura ${snapshot.number} enviada`, actorId: context.userId, invoiceId, companyId: snapshot.companyId, contactId: snapshot.contactId, opportunityId: snapshot.opportunityId } });
    await createOutboxEvent(tx, { organizationId: context.organizationId, eventType: "invoice.sent", aggregateType: "Invoice", aggregateId: invoiceId, idempotencyKey: `invoice.sent:${invoiceId}`, payload: { invoiceId, number: snapshot.number, sentAt: now.toISOString() } });
    return tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { items: true } });
  });
}

export async function recordPayment(
  input: {
    organizationId: string;
    invoiceId: string;
    amountCents: number;
    currency: string;
    method: "MANUAL" | "STRIPE";
    idempotencyKey: string;
    externalPaymentId?: string | null;
    stripePaymentIntentId?: string | null;
    recordedById?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new AppError("L’import del pagament no és vàlid", "INVALID_PAYMENT", 422);
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "Invoice"
      WHERE "id" = ${input.invoiceId} AND "organizationId" = ${input.organizationId}
      FOR UPDATE
    `;
    if (locked.length !== 1) throw new NotFoundError("No s’ha trobat la factura");

    const existing = await tx.payment.findUnique({ where: { organizationId_idempotencyKey: { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey } } });
    if (existing) return validatePaymentReplay(existing, input);
    const invoice = await tx.invoice.findFirst({ where: { id: input.invoiceId, organizationId: input.organizationId }, include: { company: true, contact: true } });
    if (!invoice) throw new NotFoundError("No s’ha trobat la factura");
    if (["CANCELLED", "DRAFT", "PAID"].includes(invoice.status)) throw new AppError("La factura no admet pagaments", "INVALID_INVOICE_STATE", 409);
    if (input.currency !== invoice.currency) throw new AppError("La divisa del pagament no coincideix amb la factura", "PAYMENT_CURRENCY_MISMATCH", 422);

    const settled = await tx.payment.aggregate({
      where: { organizationId: input.organizationId, invoiceId: invoice.id, status: "SUCCEEDED" },
      _sum: { amountCents: true, refundedAmountCents: true },
    });
    const settledAmountCents = Math.max(
      0,
      (settled._sum.amountCents ?? 0) - (settled._sum.refundedAmountCents ?? 0),
    );
    const remainingBeforePaymentCents = Math.max(0, invoice.totalCents - settledAmountCents);
    if (input.amountCents > remainingBeforePaymentCents) throw new AppError("L’import supera el saldo pendent", "OVERPAYMENT", 422);

    const now = new Date();
    const payment = await tx.payment.create({
      data: {
        organizationId: input.organizationId,
        invoiceId: invoice.id,
        amountCents: input.amountCents,
        currency: input.currency,
        status: "SUCCEEDED",
        method: input.method,
        externalPaymentId: input.externalPaymentId,
        stripePaymentIntentId: input.stripePaymentIntentId,
        idempotencyKey: input.idempotencyKey,
        receivedAt: now,
        recordedById: input.recordedById,
        metadata: input.metadata,
      },
    });
    const paidAmountCents = settledAmountCents + input.amountCents;
    const remainingAmountCents = Math.max(0, invoice.totalCents - paidAmountCents);
    const fullyPaid = remainingAmountCents === 0;
    const status = fullyPaid
      ? "PAID"
      : invoice.status === "OVERDUE" || invoice.dueDate < now
        ? "OVERDUE"
        : "PARTIALLY_PAID";
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmountCents,
        remainingAmountCents,
        status,
        paidAt: fullyPaid ? invoice.paidAt ?? now : null,
        remindersCancelledAt: fullyPaid ? invoice.remindersCancelledAt ?? now : invoice.remindersCancelledAt,
      },
    });
    if (fullyPaid) {
      await tx.scheduledJob.updateMany({ where: { invoiceId: invoice.id, status: "PENDING", type: { in: ["INVOICE_REMINDER", "INVOICE_OVERDUE"] } }, data: { status: "CANCELLED", cancelledAt: now } });
    }
    await tx.activity.create({ data: { organizationId: input.organizationId, type: "PAYMENT_RECEIVED", summary: `Pagament rebut per a la factura ${invoice.number}`, details: { amountCents: input.amountCents, method: input.method }, actorId: input.recordedById, invoiceId: invoice.id, paymentId: payment.id, companyId: invoice.companyId, contactId: invoice.contactId, opportunityId: invoice.opportunityId } });
    if (fullyPaid) {
      await createOutboxEvent(tx, { organizationId: input.organizationId, eventType: "invoice.paid", aggregateType: "Invoice", aggregateId: invoice.id, idempotencyKey: `invoice.paid:${invoice.id}`, payload: { invoiceId: invoice.id, number: invoice.number, paidAmountCents, paymentId: payment.id } });
      if (invoice.opportunityId) {
        const opportunity = await tx.opportunity.findUnique({ where: { id: invoice.opportunityId } });
        const won = opportunity ? await tx.pipelineStage.findFirst({ where: { organizationId: input.organizationId, pipelineId: opportunity.pipelineId, type: "WON" } }) : null;
        if (won) await moveOpportunityInTransaction(tx, { organizationId: input.organizationId, userId: input.recordedById ?? invoice.createdById, role: "MEMBER" }, { opportunityId: invoice.opportunityId, stageId: won.id, reason: `Factura ${invoice.number} pagada` });
      }
      const settings = await tx.organizationSettings.findUnique({ where: { organizationId: input.organizationId } });
      if (settings?.onboardingTaskOnPayment) {
        await tx.task.create({ data: { organizationId: input.organizationId, title: `Iniciar onboarding · ${invoice.company.name}`, description: `Factura ${invoice.number} pagada. Preparar l’onboarding del client.`, priority: "HIGH", dueAt: new Date(now.getTime() + 86_400_000), assignedToId: invoice.createdById, createdById: input.recordedById ?? invoice.createdById, companyId: invoice.companyId, contactId: invoice.contactId, opportunityId: invoice.opportunityId, invoiceId: invoice.id } });
      }
      const recipient = invoice.contact?.emailNormalized ?? invoice.company.emailNormalized;
      if (recipient) {
        const template = paymentConfirmationTemplate({ clientName: invoice.contact?.firstName ?? invoice.company.name, number: invoice.number, amountCents: input.amountCents, currency: invoice.currency, url: `${env().APP_URL}/i/${invoice.publicToken}` });
        const email = await tx.emailMessage.create({ data: { organizationId: input.organizationId, templateKey: "invoice.payment_received", toAddress: recipient, ccAddresses: [], bccAddresses: [], subject: template.subject, htmlBody: template.html, textBody: template.text, idempotencyKey: `invoice.payment_received:${payment.id}`, contactId: invoice.contactId, invoiceId: invoice.id } });
        await tx.scheduledJob.create({ data: { organizationId: input.organizationId, type: "EMAIL_SEND", runAt: now, payload: { emailMessageId: email.id }, emailMessageId: email.id, invoiceId: invoice.id, deduplicationKey: `email:${email.id}` } });
      }
    }
    return payment;
  });
}

function validatePaymentReplay(
  payment: Payment,
  input: {
    invoiceId: string;
    amountCents: number;
    currency: string;
    method: "MANUAL" | "STRIPE";
    externalPaymentId?: string | null;
    stripePaymentIntentId?: string | null;
  },
) {
  if (
    payment.status !== "SUCCEEDED" ||
    payment.invoiceId !== input.invoiceId ||
    payment.amountCents !== input.amountCents ||
    payment.currency !== input.currency ||
    payment.method !== input.method ||
    payment.externalPaymentId !== (input.externalPaymentId ?? null) ||
    payment.stripePaymentIntentId !== (input.stripePaymentIntentId ?? null)
  ) {
    throw new AppError("La clau d’idempotència ja s’ha utilitzat per a un altre pagament", "PAYMENT_IDEMPOTENCY_CONFLICT", 409);
  }
  return payment;
}

export async function markInvoiceOverdue(organizationId: string, invoiceId: string) {
  const invoice = await db.invoice.findFirst({ where: { id: invoiceId, organizationId } });
  if (!invoice || !["SENT", "PARTIALLY_PAID"].includes(invoice.status) || invoice.dueDate >= new Date()) return invoice;
  return db.$transaction(async (tx) => {
    const updated = await tx.invoice.update({ where: { id: invoice.id }, data: { status: "OVERDUE" } });
    await createOutboxEvent(tx, { organizationId, eventType: "invoice.overdue", aggregateType: "Invoice", aggregateId: invoice.id, idempotencyKey: `invoice.overdue:${invoice.id}`, payload: { invoiceId: invoice.id, dueDate: invoice.dueDate.toISOString() } });
    return updated;
  });
}
