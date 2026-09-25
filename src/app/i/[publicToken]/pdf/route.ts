import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { documentPdfFilename } from "@/modules/documents/filename";
import { invoicePdfByToken } from "@/modules/documents/pdf";

export async function GET(_: Request, { params }: { params: Promise<{ publicToken: string }> }) {
  const { publicToken } = await params;
  try {
    const [bytes, invoice] = await Promise.all([
      invoicePdfByToken(publicToken),
      db.invoice.findUnique({ where: { publicToken }, select: { number: true } }),
    ]);
    if (!invoice) throw new NotFoundError("No s’ha trobat la factura");
    return new Response(new Uint8Array(bytes), {
      headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${documentPdfFilename(invoice.number)}"`, "cache-control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof NotFoundError) return new Response("Document no trobat", { status: 404 });
    throw error;
  }
}
