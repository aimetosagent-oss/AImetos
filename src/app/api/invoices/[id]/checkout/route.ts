import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { publicError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { createInvoiceCheckoutSession, createPublicInvoiceCheckoutSession } from "@/modules/integrations/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const jsonRequested = wantsJson(request);
  try {
    const { id } = await params;
    const publicToken = await postedPublicToken(request);
    const checkout = publicToken
      ? await createPublicInvoiceCheckoutSession(id, publicToken)
      : await createInvoiceCheckoutSession(await requireTenant(), id);

    if (jsonRequested) return NextResponse.json({ checkout }, { status: checkout.reused ? 200 : 201 });
    return NextResponse.redirect(checkout.url, 303);
  } catch (error) {
    unstable_rethrow(error);
    const safe = publicError(error);
    if (jsonRequested) return NextResponse.json({ message: safe.message, code: safe.code }, { status: safe.status });
    return new NextResponse(safe.message, { status: safe.status, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}

async function postedPublicToken(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const value = (await request.formData()).get("publicToken");
    return typeof value === "string" ? value.trim() : "";
  }
  if (contentType.includes("application/json")) {
    const value = (await request.json()) as { publicToken?: unknown };
    return typeof value.publicToken === "string" ? value.publicToken.trim() : "";
  }
  return "";
}

function wantsJson(request: Request) {
  return (request.headers.get("accept") ?? "")
    .split(",")
    .map((value) => value.split(";", 1)[0]?.trim().toLowerCase())
    .some((value) => value === "application/json" || value?.endsWith("+json"));
}
