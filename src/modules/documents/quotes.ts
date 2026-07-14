import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError, NotFoundError } from "@/lib/errors";
import { publicToken } from "@/lib/tokens";
import type { TenantContext } from "@/lib/tenant";
import { createOutboxEvent } from "@/modules/automation/outbox";
import { quoteSentTemplate } from "@/modules/communications/templates";
import { moveOpportunityInTransaction } from "@/modules/pipeline/service";
import { calculateDocumentLines, type DocumentLineInput } from "./calculation";
import { nextDocumentNumber } from "./numbering";
import { documentTransaction } from "./transactions";
import { validateDocumentReferences } from "./validation";

export type CreateQuoteInput = {
  companyId: string;
  contactId?: string | null;
  opportunityId?: string | null;
  issueDate?: Date;
  validUntil?: Date;
  currency?: string;
  notes?: string | null;
  terms?: string | null;
  followUpDays?: number[];
  lines: DocumentLineInput[];
};

export async function createQuote(context: TenantContext, input: CreateQuoteInput) {
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
      const validUntil = input.validUntil ?? new Date(issueDate.getTime() + settings.quoteValidityDays * 86_400_000);
      const number = await nextDocumentNumber(tx, {
        organizationId: context.organizationId,
        type: "QUOTE",
        issueDate,
        prefix: settings.quotePrefix,
        padding: settings.quoteNumberLength,
      });
      const quote = await tx.quote.create({
        data: {
          organizationId: context.organizationId,
          number,
          companyId: company.id,
          contactId: contact?.id,
          opportunityId: opportunity?.id,
          issueDate,
          validUntil,
          currency: input.currency ?? settings.currency,
          subtotalCents: totals.subtotalCents,
          discountAmountCents: totals.discountAmountCents,
          taxAmountCents: totals.taxAmountCents,
          totalCents: totals.totalCents,
          notesText: input.notes,
          terms: input.terms,
          publicToken: publicToken(),
          followUpDays: input.followUpDays ?? settings.quoteFollowUpDays,
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
      await tx.activity.create({
        data: {
          organizationId: context.organizationId,
          type: "QUOTE_CREATED",
          summary: `Pressupost ${number} creat`,
          actorId: context.userId,
          quoteId: quote.id,
          companyId: quote.companyId,
          contactId: quote.contactId,
          opportunityId: quote.opportunityId,
        },
      });
      await createOutboxEvent(tx, {
        organizationId: context.organizationId,
        eventType: "quote.created",
        aggregateType: "Quote",
        aggregateId: quote.id,
        idempotencyKey: `quote.created:${quote.id}`,
        payload: { quoteId: quote.id, number, totalCents: quote.totalCents, currency: quote.currency },
      });
      return quote;
  });
}

export async function sendQuote(context: TenantContext, quoteId: string) {
  const snapshot = await db.quote.findFirst({
    where: { id: quoteId, organizationId: context.organizationId },
    include: { company: true, contact: true },
  });
  if (!snapshot) throw new NotFoundError("No s’ha trobat el pressupost");
  if (snapshot.status !== "DRAFT") throw new AppError("Només es pot enviar un pressupost en esborrany", "INVALID_QUOTE_STATE", 409);
  const recipient = snapshot.contact?.emailNormalized ?? snapshot.company.emailNormalized;
  if (!recipient) throw new AppError("El client no té cap correu electrònic", "MISSING_RECIPIENT", 422);
  const template = quoteSentTemplate({
    clientName: snapshot.contact?.firstName ?? snapshot.company.name,
    number: snapshot.number,
    totalCents: snapshot.totalCents,
    currency: snapshot.currency,
    url: `${env().APP_URL}/q/${snapshot.publicToken}`,
    validUntil: snapshot.validUntil,
  });
  const sentAt = new Date();

  return db.$transaction(async (tx) => {
    const quote = await tx.quote.updateMany({
      where: { id: quoteId, organizationId: context.organizationId, status: "DRAFT" },
      data: { status: "SENT", sentAt },
    });
    if (quote.count !== 1) throw new AppError("El pressupost ja no està en esborrany", "QUOTE_ALREADY_SENT", 409);
    const email = await tx.emailMessage.create({
      data: {
        organizationId: context.organizationId,
        templateKey: "quote.sent",
        toAddress: recipient,
        ccAddresses: [],
        bccAddresses: [],
        subject: template.subject,
        htmlBody: template.html,
        textBody: template.text,
        idempotencyKey: `quote.sent:${quoteId}`,
        contactId: snapshot.contactId,
        quoteId,
      },
    });
    const jobs: Prisma.ScheduledJobCreateManyInput[] = [
      {
        organizationId: context.organizationId,
        type: "EMAIL_SEND",
        runAt: sentAt,
        payload: { emailMessageId: email.id },
        emailMessageId: email.id,
        quoteId,
        deduplicationKey: `email:${email.id}`,
      },
      ...snapshot.followUpDays.map((day) => ({
        organizationId: context.organizationId,
        type: "QUOTE_REMINDER" as const,
        runAt: new Date(sentAt.getTime() + day * 86_400_000),
        payload: { quoteId, day },
        quoteId,
        deduplicationKey: `quote:${quoteId}:reminder:${day}`,
      })),
      {
        organizationId: context.organizationId,
        type: "QUOTE_EXPIRE",
        runAt: snapshot.validUntil,
        payload: { quoteId },
        quoteId,
        deduplicationKey: `quote:${quoteId}:expire`,
      },
    ];
    await tx.scheduledJob.createMany({ data: jobs, skipDuplicates: true });
    await tx.activity.create({
      data: {
        organizationId: context.organizationId,
        type: "QUOTE_SENT",
        summary: `Pressupost ${snapshot.number} enviat`,
        actorId: context.userId,
        quoteId,
        companyId: snapshot.companyId,
        contactId: snapshot.contactId,
        opportunityId: snapshot.opportunityId,
      },
    });
    await createOutboxEvent(tx, {
      organizationId: context.organizationId,
      eventType: "quote.sent",
      aggregateType: "Quote",
      aggregateId: quoteId,
      idempotencyKey: `quote.sent:${quoteId}`,
      payload: { quoteId, number: snapshot.number, sentAt: sentAt.toISOString() },
    });
    if (snapshot.opportunityId) {
      const stage = await tx.pipelineStage.findFirst({
        where: { organizationId: context.organizationId, pipelineId: snapshot.opportunityId ? (await tx.opportunity.findUnique({ where: { id: snapshot.opportunityId }, select: { pipelineId: true } }))?.pipelineId : undefined, name: { equals: "Proposta enviada", mode: "insensitive" } },
      });
      if (stage) await moveOpportunityInTransaction(tx, context, { opportunityId: snapshot.opportunityId, stageId: stage.id, reason: `Pressupost ${snapshot.number} enviat` });
    }
    return tx.quote.findUniqueOrThrow({ where: { id: quoteId }, include: { items: true } });
  });
}

export async function markQuoteViewed(token: string) {
  const now = new Date();
  return db.$transaction(async (tx) => {
    const sentClaim = await tx.quote.updateMany({
      where: { publicToken: token, status: "SENT", viewedAt: null },
      data: { status: "VIEWED", viewedAt: now },
    });
    const otherPublicClaim = sentClaim.count
      ? { count: 0 }
      : await tx.quote.updateMany({
          where: { publicToken: token, status: { in: ["VIEWED", "ACCEPTED", "REJECTED", "EXPIRED"] }, viewedAt: null },
          data: { viewedAt: now },
        });
    const claimedFirstView = sentClaim.count + otherPublicClaim.count === 1;
    const quote = await tx.quote.findUnique({ where: { publicToken: token } });
    if (!quote) throw new NotFoundError("No s’ha trobat el pressupost");
    if (!["SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED"].includes(quote.status)) {
      throw new AppError("Aquest pressupost no està disponible", "QUOTE_NOT_PUBLIC", 404);
    }
    if (claimedFirstView) {
      await tx.activity.create({ data: { organizationId: quote.organizationId, type: "QUOTE_VIEWED", summary: `Pressupost ${quote.number} vist`, quoteId: quote.id, companyId: quote.companyId, contactId: quote.contactId, opportunityId: quote.opportunityId } });
      await createOutboxEvent(tx, { organizationId: quote.organizationId, eventType: "quote.viewed", aggregateType: "Quote", aggregateId: quote.id, idempotencyKey: `quote.viewed:${quote.id}`, payload: { quoteId: quote.id, viewedAt: now.toISOString() } });
    }
    return quote;
  });
}

export async function decideQuote(token: string, decision: "accept" | "reject", comment?: string | null) {
  const now = new Date();
  return db.$transaction(async (tx) => {
    const status = decision === "accept" ? "ACCEPTED" : "REJECTED";
    const claimed = await tx.quote.updateMany({
      where: { publicToken: token, status: { in: ["SENT", "VIEWED"] } },
      data: {
        status,
        acceptedAt: decision === "accept" ? now : null,
        rejectedAt: decision === "reject" ? now : null,
        decisionComment: comment?.trim() || null,
        followUpsCancelledAt: now,
      },
    });
    const quote = await tx.quote.findUnique({ where: { publicToken: token } });
    if (!quote) throw new NotFoundError("No s’ha trobat el pressupost");
    if (claimed.count !== 1) {
      if (quote.status === status) return quote;
      throw new AppError("Aquest pressupost ja no admet una decisió", "INVALID_QUOTE_STATE", 409);
    }
    await tx.scheduledJob.updateMany({ where: { quoteId: quote.id, status: "PENDING", type: { in: ["QUOTE_REMINDER", "QUOTE_EXPIRE"] } }, data: { status: "CANCELLED", cancelledAt: now } });
    await tx.activity.create({
      data: {
        organizationId: quote.organizationId,
        type: decision === "accept" ? "QUOTE_ACCEPTED" : "QUOTE_REJECTED",
        summary: `Pressupost ${quote.number} ${decision === "accept" ? "acceptat" : "rebutjat"}`,
        details: comment ? { comment: comment.trim() } : undefined,
        quoteId: quote.id,
        companyId: quote.companyId,
        contactId: quote.contactId,
        opportunityId: quote.opportunityId,
      },
    });
    await createOutboxEvent(tx, {
      organizationId: quote.organizationId,
      eventType: decision === "accept" ? "quote.accepted" : "quote.rejected",
      aggregateType: "Quote",
      aggregateId: quote.id,
      idempotencyKey: `quote.${status.toLowerCase()}:${quote.id}`,
      payload: { quoteId: quote.id, status, comment: comment?.trim() ?? null },
    });
    if (decision === "accept" && quote.opportunityId) {
      const opportunity = await tx.opportunity.findUnique({ where: { id: quote.opportunityId } });
      const won = opportunity
        ? await tx.pipelineStage.findFirst({ where: { organizationId: quote.organizationId, pipelineId: opportunity.pipelineId, type: "WON" } })
        : null;
      if (won) await moveOpportunityInTransaction(tx, { organizationId: quote.organizationId, userId: quote.createdById, role: "MEMBER" }, { opportunityId: quote.opportunityId, stageId: won.id, reason: `Pressupost ${quote.number} acceptat` });
    }
    return quote;
  });
}
