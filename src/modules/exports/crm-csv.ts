import { db } from "@/lib/db";
import type { TenantContext } from "@/lib/tenant";

export const crmExportTypes = ["companies", "contacts", "opportunities", "quotes", "invoices"] as const;
export type CrmExportType = (typeof crmExportTypes)[number];

type CsvValue = string | number | boolean | Date | null | undefined;

function safeSpreadsheetText(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function csvCell(value: CsvValue): string {
  const raw = value instanceof Date ? value.toISOString() : value == null ? "" : String(value);
  const safe = safeSpreadsheetText(raw);
  return `"${safe.replaceAll('"', '""')}"`;
}

export function csvDocument(headers: string[], rows: CsvValue[][]): string {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function money(cents: number): string {
  return (cents / 100).toFixed(2);
}

function contactName(contact: { firstName: string; lastName: string | null } | null): string {
  return contact ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") : "";
}

export async function buildCrmCsvExport(context: TenantContext, type: CrmExportType): Promise<string> {
  const organizationId = context.organizationId;

  if (type === "companies") {
    const rows = await db.company.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return csvDocument(
      ["id", "nom", "rao_social", "nif", "correu", "telefon", "web", "adreca", "ciutat", "codi_postal", "pais", "sector", "font", "creat", "actualitzat"],
      rows.map((row) => [row.id, row.name, row.legalName, row.taxId, row.email, row.phone, row.website, row.address, row.city, row.postalCode, row.country, row.sector, row.source, row.createdAt, row.updatedAt]),
    );
  }

  if (type === "contacts") {
    const rows = await db.contact.findMany({
      where: { organizationId, deletedAt: null },
      include: { company: { select: { name: true } }, owner: { select: { name: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { id: "asc" }],
    });
    return csvDocument(
      ["id", "nom", "cognoms", "empresa", "correu", "telefon", "carrec", "font", "idioma", "responsable", "creat", "actualitzat"],
      rows.map((row) => [row.id, row.firstName, row.lastName, row.company?.name, row.email, row.phone, row.position, row.source, row.preferredLanguage, row.owner?.name, row.createdAt, row.updatedAt]),
    );
  }

  if (type === "opportunities") {
    const rows = await db.opportunity.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        company: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
        pipeline: { select: { name: true } },
        stage: { select: { name: true } },
        owner: { select: { name: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return csvDocument(
      ["id", "titol", "empresa", "contacte", "pipeline", "etapa", "responsable", "valor", "moneda", "probabilitat", "estat", "tancament_previst", "font", "creat", "actualitzat"],
      rows.map((row) => [row.id, row.title, row.company?.name, contactName(row.contact), row.pipeline.name, row.stage.name, row.owner?.name, money(row.valueCents), row.currency, row.probability, row.status, row.expectedCloseDate, row.source, row.createdAt, row.updatedAt]),
    );
  }

  if (type === "quotes") {
    const rows = await db.quote.findMany({
      where: { organizationId },
      include: {
        company: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
        opportunity: { select: { title: true } },
      },
      orderBy: [{ issueDate: "asc" }, { number: "asc" }],
    });
    return csvDocument(
      ["id", "numero", "estat", "empresa", "contacte", "oportunitat", "data_emissio", "valid_fins", "moneda", "subtotal", "descompte", "impostos", "total", "enviat", "acceptat", "rebutjat", "creat", "actualitzat"],
      rows.map((row) => [row.id, row.number, row.status, row.company.name, contactName(row.contact), row.opportunity?.title, row.issueDate, row.validUntil, row.currency, money(row.subtotalCents), money(row.discountAmountCents), money(row.taxAmountCents), money(row.totalCents), row.sentAt, row.acceptedAt, row.rejectedAt, row.createdAt, row.updatedAt]),
    );
  }

  const rows = await db.invoice.findMany({
    where: { organizationId },
    include: {
      company: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true } },
      opportunity: { select: { title: true } },
      quote: { select: { number: true } },
    },
    orderBy: [{ issueDate: "asc" }, { number: "asc" }],
  });
  return csvDocument(
    ["id", "numero", "estat", "empresa", "contacte", "oportunitat", "pressupost", "data_emissio", "venciment", "moneda", "subtotal", "descompte", "impostos", "total", "pagat", "pendent", "enviat", "pagat_el", "creat", "actualitzat"],
    rows.map((row) => [row.id, row.number, row.status, row.company.name, contactName(row.contact), row.opportunity?.title, row.quote?.number, row.issueDate, row.dueDate, row.currency, money(row.subtotalCents), money(row.discountAmountCents), money(row.taxAmountCents), money(row.totalCents), money(row.paidAmountCents), money(row.remainingAmountCents), row.sentAt, row.paidAt, row.createdAt, row.updatedAt]),
  );
}
