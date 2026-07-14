import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { invoiceReminderTemplate, quoteReminderTemplate } from "@/modules/communications/templates";
import { markInvoiceOverdue } from "@/modules/documents/invoices";

type EmailInput = {
  organizationId: string;
  idempotencyKey: string;
  templateKey: string;
  toAddress: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  contactId?: string | null;
  quoteId?: string | null;
  invoiceId?: string | null;
};

async function ensureOutboxEvent(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    idempotencyKey: string;
    payload: Prisma.InputJsonValue;
  },
) {
  return tx.outboxEvent.upsert({
    where: {
      organizationId_idempotencyKey: {
        organizationId: input.organizationId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    update: {},
    create: input,
  });
}

async function ensureQueuedEmail(tx: Prisma.TransactionClient, input: EmailInput) {
  const email = await tx.emailMessage.upsert({
    where: {
      organizationId_idempotencyKey: {
        organizationId: input.organizationId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    update: {},
    create: {
      organizationId: input.organizationId,
      idempotencyKey: input.idempotencyKey,
      templateKey: input.templateKey,
      toAddress: input.toAddress,
      ccAddresses: [],
      bccAddresses: [],
      subject: input.subject,
      htmlBody: input.htmlBody,
      textBody: input.textBody,
      contactId: input.contactId,
      quoteId: input.quoteId,
      invoiceId: input.invoiceId,
    },
  });

  if (email.status !== "SENT" && email.status !== "CANCELLED") {
    const deduplicationKey = `email:${email.id}`;
    await tx.scheduledJob.upsert({
      where: {
        organizationId_deduplicationKey: {
          organizationId: input.organizationId,
          deduplicationKey,
        },
      },
      update: {},
      create: {
        organizationId: input.organizationId,
        type: "EMAIL_SEND",
        runAt: new Date(),
        payload: { emailMessageId: email.id },
        maxAttempts: email.maxAttempts,
        emailMessageId: email.id,
        quoteId: input.quoteId,
        invoiceId: input.invoiceId,
        deduplicationKey,
      },
    });
  }

  return email;
}

export async function handleQuoteReminder(input: {
  organizationId: string;
  quoteId: string;
  day: number;
}): Promise<void> {
  const day = Number.isInteger(input.day) && input.day >= 0 ? input.day : 0;
  const now = new Date();

  await db.$transaction(async (tx) => {
    const quote = await tx.quote.findFirst({
      where: {
        id: input.quoteId,
        organizationId: input.organizationId,
        status: { in: ["SENT", "VIEWED"] },
        followUpEnabled: true,
        followUpsCancelledAt: null,
      },
      include: { company: true, contact: true },
    });
    if (!quote || quote.validUntil <= now) return;

    const recipient = quote.contact?.emailNormalized ?? quote.company.emailNormalized;
    if (recipient) {
      const template = quoteReminderTemplate({
        clientName: quote.contact?.firstName ?? quote.company.name,
        number: quote.number,
        url: `${env().APP_URL}/q/${quote.publicToken}`,
      });
      await ensureQueuedEmail(tx, {
        organizationId: quote.organizationId,
        idempotencyKey: `quote.reminder:${quote.id}:${day}`,
        templateKey: "quote.reminder",
        toAddress: recipient,
        subject: template.subject,
        htmlBody: template.html,
        textBody: template.text,
        contactId: quote.contactId,
        quoteId: quote.id,
      });
    }

    if (day >= 14) {
      const taskId = `quote-followup-task:${quote.id}:${day}`;
      const existingTask = await tx.task.findUnique({ where: { id: taskId }, select: { id: true } });
      if (!existingTask) {
        const task = await tx.task.create({
          data: {
            id: taskId,
            organizationId: quote.organizationId,
            title: `Seguiment comercial del pressupost ${quote.number}`,
            description: "El pressupost continua pendent després del segon recordatori.",
            status: "PENDING",
            priority: "HIGH",
            dueAt: now,
            assignedToId: quote.createdById,
            createdById: quote.createdById,
            companyId: quote.companyId,
            contactId: quote.contactId,
            opportunityId: quote.opportunityId,
            quoteId: quote.id,
          },
        });
        await tx.scheduledJob.create({
          data: {
            organizationId: quote.organizationId,
            type: "TASK_DUE",
            runAt: task.dueAt ?? now,
            payload: { taskId: task.id },
            taskId: task.id,
            deduplicationKey: `task-due:${task.id}`,
          },
        });
        await tx.activity.create({
          data: {
            organizationId: quote.organizationId,
            type: "TASK_CREATED",
            summary: `Tasca creada: ${task.title}`,
            taskId: task.id,
            quoteId: quote.id,
            companyId: quote.companyId,
            contactId: quote.contactId,
            opportunityId: quote.opportunityId,
          },
        });
        await ensureOutboxEvent(tx, {
          organizationId: quote.organizationId,
          eventType: "task.created",
          aggregateType: "Task",
          aggregateId: task.id,
          idempotencyKey: `task.created:${task.id}`,
          payload: { taskId: task.id, quoteId: quote.id, dueAt: task.dueAt?.toISOString() ?? null },
        });
      }
    }

    await ensureOutboxEvent(tx, {
      organizationId: quote.organizationId,
      eventType: "quote.followup_due",
      aggregateType: "Quote",
      aggregateId: quote.id,
      idempotencyKey: `quote.followup_due:${quote.id}:${day}`,
      payload: { quoteId: quote.id, number: quote.number, day, recipientAvailable: Boolean(recipient) },
    });
  });
}

export async function handleQuoteExpiry(input: { organizationId: string; quoteId: string }): Promise<void> {
  const now = new Date();
  await db.$transaction(async (tx) => {
    const quote = await tx.quote.findFirst({
      where: {
        id: input.quoteId,
        organizationId: input.organizationId,
        status: { in: ["SENT", "VIEWED"] },
        validUntil: { lte: now },
      },
    });
    if (!quote) return;

    const changed = await tx.quote.updateMany({
      where: {
        id: quote.id,
        organizationId: quote.organizationId,
        status: { in: ["SENT", "VIEWED"] },
      },
      data: {
        status: "EXPIRED",
        expiredAt: now,
        followUpEnabled: false,
        followUpsCancelledAt: now,
      },
    });
    if (changed.count !== 1) return;

    await tx.scheduledJob.updateMany({
      where: {
        organizationId: quote.organizationId,
        quoteId: quote.id,
        type: "QUOTE_REMINDER",
        status: "PENDING",
      },
      data: { status: "CANCELLED", cancelledAt: now, lockedAt: null, lockedBy: null },
    });
    await ensureOutboxEvent(tx, {
      organizationId: quote.organizationId,
      eventType: "quote.expired",
      aggregateType: "Quote",
      aggregateId: quote.id,
      idempotencyKey: `quote.expired:${quote.id}`,
      payload: { quoteId: quote.id, number: quote.number, expiredAt: now.toISOString() },
    });
  });
}

export async function handleInvoiceReminder(input: {
  organizationId: string;
  invoiceId: string;
  offset: number;
}): Promise<void> {
  const offset = Number.isInteger(input.offset) ? input.offset : 0;
  const now = new Date();

  await db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: {
        id: input.invoiceId,
        organizationId: input.organizationId,
        status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
        remindersEnabled: true,
        remindersCancelledAt: null,
        remainingAmountCents: { gt: 0 },
      },
      include: { company: true, contact: true },
    });
    if (!invoice) return;

    const overdue = invoice.status === "OVERDUE" || offset > 0;
    const recipient = invoice.contact?.emailNormalized ?? invoice.company.emailNormalized;
    if (recipient) {
      const template = invoiceReminderTemplate({
        clientName: invoice.contact?.firstName ?? invoice.company.name,
        number: invoice.number,
        remainingCents: invoice.remainingAmountCents,
        currency: invoice.currency,
        url: `${env().APP_URL}/i/${invoice.publicToken}`,
        overdue,
      });
      await ensureQueuedEmail(tx, {
        organizationId: invoice.organizationId,
        idempotencyKey: `invoice.reminder:${invoice.id}:${offset}`,
        templateKey: overdue ? "invoice.overdue_reminder" : "invoice.reminder",
        toAddress: recipient,
        subject: template.subject,
        htmlBody: template.html,
        textBody: template.text,
        contactId: invoice.contactId,
        invoiceId: invoice.id,
      });
    }

    if (offset >= 7) {
      const taskId = `invoice-overdue-task:${invoice.id}:${offset}`;
      const existingTask = await tx.task.findUnique({ where: { id: taskId }, select: { id: true } });
      if (!existingTask) {
        const task = await tx.task.create({
          data: {
            id: taskId,
            organizationId: invoice.organizationId,
            title: `Reclamar la factura ${invoice.number}`,
            description: "La factura continua pendent set dies després del venciment.",
            status: "PENDING",
            priority: "URGENT",
            dueAt: now,
            assignedToId: invoice.createdById,
            createdById: invoice.createdById,
            companyId: invoice.companyId,
            contactId: invoice.contactId,
            opportunityId: invoice.opportunityId,
            invoiceId: invoice.id,
          },
        });
        await tx.scheduledJob.create({
          data: {
            organizationId: invoice.organizationId,
            type: "TASK_DUE",
            runAt: task.dueAt ?? now,
            payload: { taskId: task.id },
            taskId: task.id,
            deduplicationKey: `task-due:${task.id}`,
          },
        });
        await tx.activity.create({
          data: {
            organizationId: invoice.organizationId,
            type: "TASK_CREATED",
            summary: `Tasca creada: ${task.title}`,
            taskId: task.id,
            invoiceId: invoice.id,
            companyId: invoice.companyId,
            contactId: invoice.contactId,
            opportunityId: invoice.opportunityId,
          },
        });
        await ensureOutboxEvent(tx, {
          organizationId: invoice.organizationId,
          eventType: "task.created",
          aggregateType: "Task",
          aggregateId: task.id,
          idempotencyKey: `task.created:${task.id}`,
          payload: { taskId: task.id, invoiceId: invoice.id, dueAt: task.dueAt?.toISOString() ?? null },
        });
      }
    }

    await ensureOutboxEvent(tx, {
      organizationId: invoice.organizationId,
      eventType: "invoice.reminder_due",
      aggregateType: "Invoice",
      aggregateId: invoice.id,
      idempotencyKey: `invoice.reminder_due:${invoice.id}:${offset}`,
      payload: {
        invoiceId: invoice.id,
        number: invoice.number,
        offset,
        overdue,
        remainingAmountCents: invoice.remainingAmountCents,
        recipientAvailable: Boolean(recipient),
      },
    });
  });
}

export async function handleInvoiceOverdue(input: { organizationId: string; invoiceId: string }): Promise<void> {
  await markInvoiceOverdue(input.organizationId, input.invoiceId);
}

export async function handleTaskDue(input: { organizationId: string; taskId: string }): Promise<void> {
  await db.$transaction(async (tx) => {
    const task = await tx.task.findFirst({
      where: {
        id: input.taskId,
        organizationId: input.organizationId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        deletedAt: null,
        dueAt: { lte: new Date() },
      },
    });
    if (!task?.dueAt) return;

    await ensureOutboxEvent(tx, {
      organizationId: task.organizationId,
      eventType: "task.due",
      aggregateType: "Task",
      aggregateId: task.id,
      idempotencyKey: `task.due:${task.id}:${task.dueAt.toISOString()}`,
      payload: {
        taskId: task.id,
        title: task.title,
        dueAt: task.dueAt.toISOString(),
        assignedToId: task.assignedToId,
      },
    });
  });
}
