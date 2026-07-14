import { quotePdfByToken } from "@/modules/documents/pdf";
import { NotFoundError } from "@/lib/errors";

export async function GET(_: Request, { params }: { params: Promise<{ publicToken: string }> }) {
  const { publicToken } = await params;
  try {
    const bytes = await quotePdfByToken(publicToken);
    return new Response(new Uint8Array(bytes), {
      headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="pressupost.pdf"`, "cache-control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof NotFoundError) return new Response("Document no trobat", { status: 404 });
    throw error;
  }
}
