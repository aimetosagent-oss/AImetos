import type { DocumentType, Prisma } from "@prisma/client";

export function formatDocumentNumber(prefix: string, year: number, value: number, padding = 4) {
  return `${prefix}-${year}-${String(value).padStart(padding, "0")}`;
}

export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; type: DocumentType; issueDate: Date; prefix: string; padding: number },
) {
  const year = input.issueDate.getUTCFullYear();
  const sequence = await tx.documentSequence.upsert({
    where: { organizationId_type_year: { organizationId: input.organizationId, type: input.type, year } },
    create: {
      organizationId: input.organizationId,
      type: input.type,
      year,
      prefix: input.prefix,
      padding: input.padding,
      nextValue: 2,
    },
    update: { nextValue: { increment: 1 } },
  });
  return formatDocumentNumber(sequence.prefix, sequence.year, sequence.nextValue - 1, sequence.padding);
}
