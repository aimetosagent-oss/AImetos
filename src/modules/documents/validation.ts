import type { Prisma } from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import type { DocumentLineInput } from "./calculation";

export async function validateDocumentReferences(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    companyId: string;
    contactId?: string | null;
    opportunityId?: string | null;
    lines: DocumentLineInput[];
  },
) {
  const productIds = [...new Set(input.lines.flatMap((line) => (line.productId ? [line.productId] : [])))];
  const [company, contact, opportunity, products] = await Promise.all([
    tx.company.findFirst({ where: { id: input.companyId, organizationId: input.organizationId, deletedAt: null } }),
    input.contactId
      ? tx.contact.findFirst({ where: { id: input.contactId, organizationId: input.organizationId, deletedAt: null } })
      : null,
    input.opportunityId
      ? tx.opportunity.findFirst({ where: { id: input.opportunityId, organizationId: input.organizationId, deletedAt: null } })
      : null,
    productIds.length
      ? tx.product.findMany({
          where: { id: { in: productIds }, organizationId: input.organizationId, deletedAt: null },
          select: { id: true },
        })
      : [],
  ]);

  if (!company) throw new NotFoundError("No s'ha trobat l'empresa");
  if (input.contactId && !contact) {
    throw new AppError("El contacte no pertany a l'organització", "INVALID_CONTACT", 422);
  }
  if (contact && contact.companyId !== company.id) {
    throw new AppError("El contacte no pertany a l'empresa seleccionada", "CONTACT_COMPANY_MISMATCH", 422);
  }
  if (input.opportunityId && !opportunity) {
    throw new AppError("L'oportunitat no pertany a l'organització", "INVALID_OPPORTUNITY", 422);
  }
  if (opportunity && opportunity.companyId !== company.id) {
    throw new AppError("L'oportunitat no pertany a l'empresa seleccionada", "OPPORTUNITY_COMPANY_MISMATCH", 422);
  }
  if (products.length !== productIds.length) {
    throw new AppError("Un dels productes no pertany a l'organització", "INVALID_PRODUCT", 422);
  }

  return { company, contact, opportunity };
}
