import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { documentPdfFilename } from "@/modules/documents/filename";
import { renderDocumentPdf } from "@/modules/documents/pdf";

export async function GET(_: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  const { organizationId } = await requireTenant();
  const { type, id } = await params;
  if (type !== "quotes" && type !== "invoices") return new Response("Document no trobat", { status: 404 });
  const include = { company: true, items: { orderBy: { position: "asc" as const } }, organization: { include: { settings: true } } };
  const document = type === "quotes" ? await db.quote.findFirst({ where: { id, organizationId }, include }) : await db.invoice.findFirst({ where: { id, organizationId }, include });
  if (!document?.organization.settings) return new Response("Document no trobat", { status: 404 });
  const isQuote = "validUntil" in document;
  const bytes = await renderDocumentPdf({
    kind: isQuote ? "Pressupost" : "Factura",
    number: document.status === "DRAFT" ? `${document.number} · ESBORRANY` : document.number,
    issueDate: document.issueDate, dueDate: isQuote ? document.validUntil : document.dueDate,
    dueLabel: isQuote ? "Vàlid fins al" : "Venciment", currency: document.currency,
    subtotalCents: document.subtotalCents, discountCents: document.discountAmountCents,
    taxCents: document.taxAmountCents, totalCents: document.totalCents,
    notes: document.notesText, terms: document.terms, client: document.company,
    organization: document.organization.settings, lines: document.items,
  });
  return new Response(new Uint8Array(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${documentPdfFilename(document.number)}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
