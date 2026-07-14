import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import type { Prisma } from "@prisma/client";

import { decryptSecret, webhookSignature } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { nextRetryAt } from "@/lib/jobs";

const WEBHOOK_TIMEOUT_MS = 10_000;
const RESPONSE_BODY_LIMIT_BYTES = 32 * 1024;
const STORED_TEXT_LIMIT = 4_000;

type OutboxRow = { id: string };

class PermanentWebhookError extends Error {}

export class WebhookRetryRequestedError extends Error {}

type DeliveryAttempt = {
  ok: boolean;
  retryable: boolean;
  error?: string;
  requestHeaders?: Record<string, string>;
  responseStatus?: number;
  responseBody?: string;
};

function sanitizeStoredText(value: string): string {
  return value
    .replaceAll("\u0000", "")
    .replace(
      /("(?:access_token|refresh_token|api[_-]?key|secret|password|authorization)"\s*:\s*)"[^"]*"/gi,
      '$1"[REDACTED]"',
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .slice(0, STORED_TEXT_LIMIT);
}

function messageFrom(error: unknown): string {
  return sanitizeStoredText(error instanceof Error ? error.message : String(error));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized) || normalized.startsWith("ff")) return true;
  if (normalized.startsWith("::ffff:")) return isPrivateIpv4(normalized.slice(7));
  return false;
}

async function validateOutboundUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PermanentWebhookError("La URL del webhook no és vàlida.");
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new PermanentWebhookError("El webhook només admet HTTP o HTTPS.");
  }
  if (url.username || url.password) {
    throw new PermanentWebhookError("La URL del webhook no pot incloure credencials.");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new PermanentWebhookError("Els webhooks de producció han d'utilitzar HTTPS.");
  }

  if (process.env.NODE_ENV === "production") {
    if (url.hostname.toLowerCase() === "localhost") {
      throw new PermanentWebhookError("No es permeten destinacions locals en producció.");
    }
    let addresses: LookupAddress[];
    try {
      addresses = await lookup(url.hostname, { all: true, verbatim: true });
    } catch (error) {
      throw new WebhookRetryRequestedError(`No s'ha pogut resoldre el host del webhook: ${messageFrom(error)}`);
    }
    if (!addresses.length) throw new WebhookRetryRequestedError("El host del webhook no ha retornat cap adreça.");
    if (addresses.some((entry) => (entry.family === 4 ? isPrivateIpv4(entry.address) : isPrivateIpv6(entry.address)))) {
      throw new PermanentWebhookError("La destinació del webhook apunta a una xarxa privada o reservada.");
    }
  }

  return url;
}

async function responseSnippet(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (bytes < RESPONSE_BODY_LIMIT_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = RESPONSE_BODY_LIMIT_BYTES - bytes;
      const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      bytes += chunk.byteLength;
      text += decoder.decode(chunk, { stream: bytes < RESPONSE_BODY_LIMIT_BYTES });
      if (chunk.byteLength < value.byteLength) break;
    }
    text += decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return sanitizeStoredText(text);
}

function serializedEvent(event: {
  id: string;
  eventType: string;
  occurredAt: Date;
  organizationId: string;
  aggregateType: string;
  aggregateId: string;
  payload: Prisma.JsonValue;
}): string {
  return JSON.stringify({
    id: event.id,
    type: event.eventType,
    occurredAt: event.occurredAt.toISOString(),
    organizationId: event.organizationId,
    aggregate: { type: event.aggregateType, id: event.aggregateId },
    data: event.payload,
  });
}

/**
 * Converts durable outbox rows into delivery jobs in a short database-only
 * transaction. No network call occurs while an outbox row is locked.
 */
export async function dispatchPendingOutboxEvents(batchSize = 25): Promise<number> {
  const limit = Math.max(1, Math.min(batchSize, 100));
  return db.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<OutboxRow[]>`
        SELECT "id"
        FROM "OutboxEvent"
        WHERE "status" = CAST('PENDING' AS "OutboxStatus")
          AND "availableAt" <= NOW()
        ORDER BY "availableAt" ASC, "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      `;

      for (const row of rows) {
        const event = await tx.outboxEvent.findUnique({ where: { id: row.id } });
        if (!event) continue;

        const endpoints = event.webhookDispatchEnabled
          ? await tx.webhookEndpoint.findMany({
              where: {
                organizationId: event.organizationId,
                isActive: true,
                archivedAt: null,
                eventTypes: { has: event.eventType },
              },
              select: { id: true },
            })
          : [];

        for (const endpoint of endpoints) {
          const delivery = await tx.webhookDelivery.upsert({
            where: { endpointId_eventId: { endpointId: endpoint.id, eventId: event.id } },
            update: {},
            create: {
              organizationId: event.organizationId,
              endpointId: endpoint.id,
              eventId: event.id,
              status: "PENDING",
              nextAttemptAt: new Date(),
              maxAttempts: 8,
            },
          });

          const deduplicationKey = `webhook:${delivery.id}`;
          await tx.scheduledJob.upsert({
            where: {
              organizationId_deduplicationKey: {
                organizationId: event.organizationId,
                deduplicationKey,
              },
            },
            update: {},
            create: {
              organizationId: event.organizationId,
              type: "WEBHOOK_DELIVERY",
              status: "PENDING",
              runAt: delivery.nextAttemptAt,
              payload: { webhookDeliveryId: delivery.id },
              maxAttempts: delivery.maxAttempts,
              outboxEventId: event.id,
              webhookDeliveryId: delivery.id,
              deduplicationKey,
            },
          });
        }

        await tx.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: "DELIVERED",
            processedAt: new Date(),
            attempts: { increment: 1 },
            lastError: null,
          },
        });
      }

      return rows.length;
    },
    { timeout: 15_000 },
  );
}

export async function deliverWebhook(webhookDeliveryId: string, workerId: string): Promise<void> {
  const initial = await db.webhookDelivery.findUnique({
    where: { id: webhookDeliveryId },
    include: { endpoint: true, event: true },
  });
  if (!initial || initial.status === "SUCCEEDED" || initial.status === "CANCELLED" || initial.status === "FAILED") return;

  if (!initial.endpoint.isActive || initial.endpoint.archivedAt) {
    await db.webhookDelivery.updateMany({
      where: { id: initial.id, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "CANCELLED", lockedAt: null, lockedBy: null, lastError: "Endpoint desactivat o arxivat." },
    });
    return;
  }

  const claimed = await db.webhookDelivery.updateMany({
    where: {
      id: initial.id,
      status: "PENDING",
      nextAttemptAt: { lte: new Date() },
    },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
      lockedAt: new Date(),
      lockedBy: workerId,
      lastError: null,
    },
  });
  if (claimed.count !== 1) return;

  const delivery = await db.webhookDelivery.findUniqueOrThrow({
    where: { id: initial.id },
    include: { endpoint: true, event: true },
  });

  let attempt: DeliveryAttempt;
  try {
    const encryptionKey = env().INTEGRATION_ENCRYPTION_KEY;
    if (!encryptionKey) throw new PermanentWebhookError("Falta INTEGRATION_ENCRYPTION_KEY.");
    const target = await validateOutboundUrl(delivery.endpoint.url);
    let secret: string;
    try {
      secret = decryptSecret(delivery.endpoint.secretEncrypted, encryptionKey);
    } catch {
      throw new PermanentWebhookError("No s'ha pogut desxifrar el secret del webhook.");
    }
    const rawBody = serializedEvent(delivery.event);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const requestHeaders = {
      "Content-Type": "application/json; charset=utf-8",
      "X-Aimetos-Event": delivery.event.eventType,
      "X-Aimetos-Event-Id": delivery.event.id,
      "X-Aimetos-Timestamp": timestamp,
      "X-Aimetos-Signature": webhookSignature(secret, timestamp, rawBody),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const response = await fetch(target, {
        method: "POST",
        headers: requestHeaders,
        body: rawBody,
        signal: controller.signal,
        redirect: "manual",
      });
      const body = await responseSnippet(response);
      attempt = {
        ok: response.ok,
        retryable: !response.ok && isRetryableStatus(response.status),
        error: response.ok ? undefined : `El webhook ha respost HTTP ${response.status}.`,
        requestHeaders,
        responseStatus: response.status,
        responseBody: body,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    const permanent = error instanceof PermanentWebhookError;
    attempt = {
      ok: false,
      retryable: !permanent,
      error: messageFrom(error),
    };
  }

  if (attempt.ok) {
    await db.$transaction([
      db.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "SUCCEEDED",
          requestHeaders: attempt.requestHeaders,
          responseStatus: attempt.responseStatus,
          responseBody: attempt.responseBody,
          lastError: null,
          deliveredAt: new Date(),
          lockedAt: null,
          lockedBy: null,
        },
      }),
      db.activity.create({
        data: {
          organizationId: delivery.organizationId,
          type: "WEBHOOK_SENT",
          summary: `Webhook enviat: ${delivery.event.eventType}`,
          details: {
            eventId: delivery.event.id,
            endpointId: delivery.endpoint.id,
            responseStatus: attempt.responseStatus ?? null,
          },
        },
      }),
    ]);
    return;
  }

  const retry = attempt.retryable && delivery.attempts < delivery.maxAttempts;
  const retryAt = retry ? nextRetryAt(delivery.attempts) : delivery.nextAttemptAt;
  await db.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: retry ? "PENDING" : "FAILED",
      nextAttemptAt: retryAt,
      requestHeaders: attempt.requestHeaders,
      responseStatus: attempt.responseStatus,
      responseBody: attempt.responseBody,
      lastError: attempt.error ?? "Error desconegut en enviar el webhook.",
      lockedAt: null,
      lockedBy: null,
    },
  });

  if (retry) throw new WebhookRetryRequestedError(attempt.error ?? "Cal reintentar el webhook.");
}
