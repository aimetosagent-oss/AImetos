import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { constructStripeWebhookEvent, processStripeEvent } from "@/modules/integrations/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const event = constructStripeWebhookEvent(rawBody, request.headers.get("stripe-signature"));
    const result = await processStripeEvent(event);
    if (result.reason === "already_processing" || result.reason === "already_claimed") {
      return NextResponse.json({ received: false, ...result }, { status: 409 });
    }
    log("info", "Stripe webhook processat", {
      stripeEventId: event.id,
      stripeEventType: event.type,
      status: result.status,
      reason: result.reason,
      duplicate: result.duplicate,
      persisted: result.persisted,
    });
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "STRIPE_WEBHOOK_ERROR";
    const status = typeof error === "object" && error && "status" in error && Number.isInteger(error.status) ? Number(error.status) : 500;
    log(status >= 500 ? "error" : "warn", "No s’ha pogut processar el webhook Stripe", { code });
    return NextResponse.json(
      { received: false, message: status >= 500 ? "No s’ha pogut processar l’esdeveniment Stripe" : "Webhook Stripe no vàlid", code },
      { status },
    );
  }
}
