import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

export type OutboxInput = {
  organizationId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Prisma.InputJsonValue;
  webhookDispatchEnabled?: boolean;
  idempotencyKey?: string;
};

export function createOutboxEvent(tx: Prisma.TransactionClient, input: OutboxInput) {
  return tx.outboxEvent.create({
    data: {
      ...input,
      idempotencyKey: input.idempotencyKey ?? `${input.eventType}:${input.aggregateId}:${randomUUID()}`,
    },
  });
}
