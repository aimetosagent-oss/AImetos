import type { DocumentType, Prisma } from "@prisma/client";

export function documentDateKey(issueDate: Date, timeZone = "Europe/Madrid") {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(issueDate);
  const value = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value;
  return `${value("year")}${value("month")}${value("day")}`;
}

export function formatDocumentNumber(prefix: string, periodKey: string, value: number, padding = 2) {
  return `${prefix}-${periodKey}-${String(value).padStart(padding, "0")}`;
}

export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; type: DocumentType; issueDate: Date; prefix: string; padding: number; timeZone?: string },
) {
  const periodKey = documentDateKey(input.issueDate, input.timeZone);
  const sequence = await tx.documentSequence.upsert({
    where: { organizationId_type_periodKey: { organizationId: input.organizationId, type: input.type, periodKey } },
    create: {
      organizationId: input.organizationId,
      type: input.type,
      periodKey,
      prefix: input.prefix,
      padding: input.padding,
      nextValue: 2,
    },
    update: { nextValue: { increment: 1 } },
  });
  return formatDocumentNumber(sequence.prefix, sequence.periodKey, sequence.nextValue - 1, sequence.padding);
}
