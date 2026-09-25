import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { documentPdfFilename } from "@/modules/documents/filename";
import { quotePdfByToken } from "@/modules/documents/pdf";

export async function GET(_: Request, { params }: { params: Promise<{ publicToken: string }> }) {
  const { publicToken } = await params;
  try {
    const [bytes, quote] = await Promise.all([
      quotePdfByToken(publicToken),
      db.quote.findUnique({ where: { publicToken }, select: { number: true } }),
    ]);
    if (!quote) throw new NotFoundError("No s’ha trobat el pressupost");
    return new Response(new Uint8Array(bytes), {
      headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${documentPdfFilename(quote.number)}"`, "cache-control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof NotFoundError) return new Response("Document no trobat", { status: 404 });
    throw error;
  }
}
