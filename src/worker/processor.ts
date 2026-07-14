import type { Prisma, ScheduledJob } from "@prisma/client";

import { sendQueuedEmail } from "@/modules/communications/email";
import {
  handleInvoiceOverdue,
  handleInvoiceReminder,
  handleQuoteExpiry,
  handleQuoteReminder,
  handleTaskDue,
} from "@/modules/automation/reminders";
import { deliverWebhook } from "@/modules/automation/webhooks";

export class PermanentJobError extends Error {}

function payloadRecord(payload: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, Prisma.JsonValue>)
    : {};
}

function payloadString(job: ScheduledJob, key: string): string | null {
  const value = payloadRecord(job.payload)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function payloadNumber(job: ScheduledJob, key: string, fallback = 0): number {
  const value = payloadRecord(job.payload)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function requiredId(value: string | null | undefined, type: string): string {
  if (!value) throw new PermanentJobError(`La feina ${type} no conté l'identificador requerit.`);
  return value;
}

export async function processScheduledJob(job: ScheduledJob, workerId: string): Promise<void> {
  switch (job.type) {
    case "EMAIL_SEND": {
      const emailMessageId = requiredId(job.emailMessageId ?? payloadString(job, "emailMessageId"), job.type);
      await sendQueuedEmail(emailMessageId);
      return;
    }
    case "QUOTE_REMINDER": {
      const quoteId = requiredId(job.quoteId ?? payloadString(job, "quoteId"), job.type);
      await handleQuoteReminder({
        organizationId: job.organizationId,
        quoteId,
        day: payloadNumber(job, "day"),
      });
      return;
    }
    case "QUOTE_EXPIRE": {
      const quoteId = requiredId(job.quoteId ?? payloadString(job, "quoteId"), job.type);
      await handleQuoteExpiry({ organizationId: job.organizationId, quoteId });
      return;
    }
    case "INVOICE_REMINDER": {
      const invoiceId = requiredId(job.invoiceId ?? payloadString(job, "invoiceId"), job.type);
      await handleInvoiceReminder({
        organizationId: job.organizationId,
        invoiceId,
        offset: payloadNumber(job, "offset"),
      });
      return;
    }
    case "INVOICE_OVERDUE": {
      const invoiceId = requiredId(job.invoiceId ?? payloadString(job, "invoiceId"), job.type);
      await handleInvoiceOverdue({ organizationId: job.organizationId, invoiceId });
      return;
    }
    case "WEBHOOK_DELIVERY": {
      const deliveryId = requiredId(
        job.webhookDeliveryId ?? payloadString(job, "webhookDeliveryId"),
        job.type,
      );
      await deliverWebhook(deliveryId, workerId);
      return;
    }
    case "TASK_DUE": {
      const taskId = requiredId(job.taskId ?? payloadString(job, "taskId"), job.type);
      await handleTaskDue({ organizationId: job.organizationId, taskId });
      return;
    }
    case "STRIPE_EVENT":
    case "GENERIC":
      throw new PermanentJobError(`No hi ha cap processador registrat per a ${job.type}.`);
    default: {
      const exhaustive: never = job.type;
      throw new PermanentJobError(`Tipus de feina desconegut: ${String(exhaustive)}`);
    }
  }
}
