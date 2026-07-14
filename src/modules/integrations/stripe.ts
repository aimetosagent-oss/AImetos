import { Prisma } from "@prisma/client";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { env, stripeTestConfigurationIsComplete } from "@/lib/env";
import { AppError, NotFoundError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenant";
import { recordPayment } from "@/modules/documents/invoices";

const HANDLED_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

const EVENT_PROCESSING_LEASE_MS = 5 * 60_000;

type StripeRecord = Record<string, unknown>;

type ResolvedEventContext = {
  organizationId: string;
  invoiceId?: string;
  companyId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
  subscriptionRecordId?: string;
};

type HandledEvent = {
  status: "PROCESSED" | "IGNORED";
  invoiceId?: string;
  paymentId?: string;
  stripeSubscriptionId?: string;
  reason?: string;
};

export type StripeEventResult = HandledEvent & {
  eventId: string;
  duplicate: boolean;
  persisted: boolean;
};

const checkoutInvoiceInclude = {
  company: true,
  contact: true,
  organization: {
    select: {
      settings: {
        select: { stripeEnabled: true, stripeTestMode: true },
      },
    },
  },
} satisfies Prisma.InvoiceInclude;

type CheckoutInvoice = Prisma.InvoiceGetPayload<{ include: typeof checkoutInvoiceInclude }>;

export type StripeSecretMode = "missing" | "test" | "live" | "invalid";

export function stripeSecretMode(secret = process.env.STRIPE_SECRET_KEY): StripeSecretMode {
  const value = secret?.trim();
  if (!value) return "missing";
  if (value.startsWith("sk_test_")) return "test";
  if (value.startsWith("sk_live_") || value.startsWith("rk_live_")) return "live";
  return "invalid";
}

export function stripePaymentIdempotencyKey(paymentIntentId?: string | null, fallbackId?: string | null) {
  if (paymentIntentId) return `stripe:payment_intent:${paymentIntentId}`;
  if (fallbackId) return `stripe:payment:${fallbackId}`;
  throw new AppError("Falta l’identificador del pagament Stripe", "STRIPE_PAYMENT_ID_MISSING", 422);
}

function requireStripeTestConfiguration() {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  const mode = stripeSecretMode(secret);
  const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (mode === "live" || publishable?.startsWith("pk_live_")) {
    throw new AppError("Les claus live de Stripe estan bloquejades en aquest MVP", "STRIPE_LIVE_MODE_FORBIDDEN", 503);
  }
  if (!secret || !publishable || !webhookSecret) {
    throw new AppError("La configuració completa de Stripe no està disponible", "STRIPE_NOT_CONFIGURED", 503);
  }
  if (
    mode !== "test" ||
    !stripeTestConfigurationIsComplete({
      STRIPE_SECRET_KEY: secret,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: publishable,
      STRIPE_WEBHOOK_SECRET: webhookSecret,
    })
  ) {
    throw new AppError("La configuració de Stripe no és vàlida", "STRIPE_INVALID_CONFIGURATION", 503);
  }
  return { secret, webhookSecret };
}

function stripeClient() {
  return new Stripe(requireStripeTestConfiguration().secret, { maxNetworkRetries: 2 });
}

export function constructStripeWebhookEvent(rawBody: string, signature: string | null) {
  if (!signature) throw new AppError("Falta la signatura de Stripe", "STRIPE_SIGNATURE_MISSING", 400);
  try {
    const configuration = requireStripeTestConfiguration();
    const event = new Stripe(configuration.secret, { maxNetworkRetries: 2 }).webhooks.constructEvent(
      rawBody,
      signature,
      configuration.webhookSecret,
    );
    if (event.livemode) throw new AppError("Els esdeveniments live de Stripe estan bloquejats", "STRIPE_LIVE_EVENT_FORBIDDEN", 400);
    return event;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("La signatura del webhook Stripe no és vàlida", "STRIPE_INVALID_SIGNATURE", 400);
  }
}

export async function createInvoiceCheckoutSession(context: TenantContext, invoiceId: string) {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, organizationId: context.organizationId },
    include: checkoutInvoiceInclude,
  });
  if (!invoice) throw new NotFoundError("No s’ha trobat la factura");

  return createCheckoutForInvoice(invoice);
}

export async function createPublicInvoiceCheckoutSession(invoiceId: string, publicToken: string) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(publicToken)) {
    throw new NotFoundError("No s’ha trobat la factura");
  }

  // The capability token is the sole source of tenant context. The URL invoice ID
  // is only a cross-check, never an input used to discover another tenant's data.
  const invoice = await db.invoice.findUnique({
    where: { publicToken },
    include: checkoutInvoiceInclude,
  });
  if (!invoice || invoice.id !== invoiceId) throw new NotFoundError("No s’ha trobat la factura");

  return createCheckoutForInvoice(invoice);
}

async function createCheckoutForInvoice(invoice: CheckoutInvoice) {
  requireOrganizationCheckoutEnabled(invoice);
  const stripe = stripeClient();
  if (!["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)) {
    throw new AppError("Aquesta factura no es pot pagar en l’estat actual", "INVALID_INVOICE_STATE", 409);
  }
  if (invoice.remainingAmountCents <= 0) throw new AppError("La factura ja està pagada", "INVOICE_ALREADY_PAID", 409);

  const customerId = await ensureStripeCustomer(stripe, invoice);
  const publicInvoiceUrl = new URL(`/i/${invoice.publicToken}`, env().APP_URL).toString();

  if (invoice.stripeCheckoutSessionId) {
    const existing = await retrieveCheckoutSession(stripe, invoice.stripeCheckoutSessionId);
    const matchesCurrentInvoice = existing && checkoutSessionMatchesInvoice(existing, invoice, customerId);
    if (matchesCurrentInvoice && existing.status === "open" && existing.url) {
      return { id: existing.id, url: existing.url, reused: true };
    }
    if (matchesCurrentInvoice && existing.status === "complete") {
      return { id: existing.id, url: `${publicInvoiceUrl}?payment=processing`, reused: true };
    }
  }

  const metadata = checkoutMetadata(invoice);
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer: customerId,
      client_reference_id: invoice.id,
      success_url: `${publicInvoiceUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicInvoiceUrl}?payment=cancelled`,
      locale: "auto",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: invoice.currency.toLowerCase(),
            unit_amount: invoice.remainingAmountCents,
            product_data: {
              name: `Factura ${invoice.number}`,
              description: invoice.company.name,
              metadata,
            },
          },
        },
      ],
      metadata,
      payment_intent_data: {
        description: `Factura ${invoice.number}`,
        metadata,
      },
    },
    {
      idempotencyKey: checkoutIdempotencyKey(invoice, customerId),
    },
  );
  if (!session.url) throw new AppError("Stripe no ha retornat cap URL de Checkout", "STRIPE_CHECKOUT_URL_MISSING", 502);

  await db.invoice.updateMany({
    where: { id: invoice.id, organizationId: invoice.organizationId },
    data: {
      stripeCustomerId: customerId,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: stripeId(session.payment_intent) ?? null,
    },
  });

  return { id: session.id, url: session.url, reused: false };
}

function requireOrganizationCheckoutEnabled(invoice: CheckoutInvoice) {
  const settings = invoice.organization.settings;
  if (!settings?.stripeEnabled) {
    throw new AppError("Els pagaments Stripe no estan activats per a aquesta organització", "STRIPE_DISABLED", 409);
  }
  if (!settings.stripeTestMode) {
    throw new AppError("Aquest MVP només permet Stripe en mode test", "STRIPE_LIVE_MODE_FORBIDDEN", 503);
  }
}

async function ensureStripeCustomer(stripe: Stripe, invoice: CheckoutInvoice) {
  if (invoice.stripeCustomerId && invoice.company.stripeCustomerId && invoice.stripeCustomerId !== invoice.company.stripeCustomerId) {
    throw new AppError("La factura i l’empresa tenen clients Stripe diferents", "STRIPE_CUSTOMER_CONFLICT", 409);
  }
  const existingId = invoice.stripeCustomerId ?? invoice.company.stripeCustomerId;
  if (existingId) {
    if (!invoice.company.stripeCustomerId) {
      await linkStripeCustomerToCompany(invoice, existingId);
    }
    await linkStripeCustomerToInvoice(invoice, existingId);
    return existingId;
  }

  const email = invoice.contact?.emailNormalized ?? invoice.company.emailNormalized ?? undefined;
  const customer = await stripe.customers.create(
    {
      name: invoice.company.name,
      email,
      metadata: {
        aimetosOrganizationId: invoice.organizationId,
        aimetosCompanyId: invoice.companyId,
      },
    },
    { idempotencyKey: `aimetos:customer:${invoice.organizationId}:${invoice.companyId}` },
  );

  await linkStripeCustomerToCompany(invoice, customer.id);
  await linkStripeCustomerToInvoice(invoice, customer.id);
  return customer.id;
}

async function linkStripeCustomerToInvoice(invoice: CheckoutInvoice, stripeCustomerId: string) {
  if (invoice.stripeCustomerId === stripeCustomerId) return;
  if (invoice.stripeCustomerId) {
    throw new AppError("La factura ja està vinculada a un altre client Stripe", "STRIPE_CUSTOMER_CONFLICT", 409);
  }
  const linked = await db.invoice.updateMany({
    where: { id: invoice.id, organizationId: invoice.organizationId, stripeCustomerId: null },
    data: { stripeCustomerId },
  });
  if (linked.count === 1) return;

  const current = await db.invoice.findFirst({
    where: { id: invoice.id, organizationId: invoice.organizationId },
    select: { stripeCustomerId: true },
  });
  if (current?.stripeCustomerId !== stripeCustomerId) {
    throw new AppError("La factura ja està vinculada a un altre client Stripe", "STRIPE_CUSTOMER_CONFLICT", 409);
  }
}

async function linkStripeCustomerToCompany(invoice: CheckoutInvoice, stripeCustomerId: string) {
  const linked = await db.company.updateMany({
    where: { id: invoice.companyId, organizationId: invoice.organizationId, stripeCustomerId: null },
    data: { stripeCustomerId },
  });
  if (linked.count === 1) return;

  const current = await db.company.findFirst({
    where: { id: invoice.companyId, organizationId: invoice.organizationId },
    select: { stripeCustomerId: true },
  });
  if (!current) throw new NotFoundError("No s’ha trobat l’empresa vinculada a Stripe");
  if (current.stripeCustomerId !== stripeCustomerId) {
    throw new AppError("L’empresa ja està vinculada a un altre client Stripe", "STRIPE_CUSTOMER_CONFLICT", 409);
  }
}

async function retrieveCheckoutSession(stripe: Stripe, sessionId: string) {
  try {
    return await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    if (stripeErrorCode(error) === "resource_missing") return null;
    throw error;
  }
}

function checkoutMetadata(invoice: CheckoutInvoice) {
  const metadata: Record<string, string> = {
    aimetosOrganizationId: invoice.organizationId,
    aimetosInvoiceId: invoice.id,
    aimetosCompanyId: invoice.companyId,
  };
  if (invoice.contactId) metadata.aimetosContactId = invoice.contactId;
  if (invoice.opportunityId) metadata.aimetosOpportunityId = invoice.opportunityId;
  return metadata;
}

function checkoutSessionMatchesInvoice(session: Stripe.Checkout.Session, invoice: CheckoutInvoice, stripeCustomerId: string) {
  return (
    session.amount_total === invoice.remainingAmountCents &&
    session.currency?.toUpperCase() === invoice.currency.toUpperCase() &&
    stripeId(session.customer) === stripeCustomerId &&
    session.client_reference_id === invoice.id &&
    session.metadata?.aimetosOrganizationId === invoice.organizationId &&
    session.metadata?.aimetosInvoiceId === invoice.id
  );
}

function checkoutIdempotencyKey(invoice: CheckoutInvoice, stripeCustomerId: string) {
  const predecessor = invoice.stripeCheckoutSessionId ?? "initial";
  return `aimetos:checkout:${invoice.id}:${invoice.remainingAmountCents}:${invoice.currency.toUpperCase()}:${stripeCustomerId}:${predecessor}`;
}

export async function processStripeEvent(event: Stripe.Event): Promise<StripeEventResult> {
  if (event.livemode) throw new AppError("Els esdeveniments live de Stripe estan bloquejats", "STRIPE_LIVE_EVENT_FORBIDDEN", 400);
  const context = await resolveEventContext(event);
  if (!context) {
    // StripeEvent requires organizationId. Events owned by another integration in
    // the same Stripe account cannot be persisted safely, so acknowledge them as
    // unowned instead of causing Stripe to retry them indefinitely.
    return {
      eventId: event.id,
      status: "IGNORED",
      reason: HANDLED_EVENT_TYPES.has(event.type) ? "unowned_handled_event" : "unresolved_organization",
      duplicate: false,
      persisted: false,
    };
  }

  const stored = await findOrCreateStripeEvent(event, context.organizationId);
  if (["PROCESSED", "IGNORED"].includes(stored.status)) {
    return {
      eventId: event.id,
      status: stored.status as "PROCESSED" | "IGNORED",
      invoiceId: stored.invoiceId ?? undefined,
      paymentId: stored.paymentId ?? undefined,
      stripeSubscriptionId: stored.stripeSubscriptionId ?? undefined,
      duplicate: true,
      persisted: true,
    };
  }

  const staleBefore = new Date(Date.now() - EVENT_PROCESSING_LEASE_MS);
  if (stored.status === "PROCESSING" && stored.updatedAt > staleBefore) {
    return { eventId: event.id, status: "IGNORED", reason: "already_processing", duplicate: true, persisted: true };
  }

  const claim = await db.stripeEvent.updateMany({
    where: {
      id: stored.id,
      status: stored.status,
      ...(stored.status === "PROCESSING" ? { updatedAt: { lte: staleBefore } } : {}),
    },
    data: { status: "PROCESSING", attempts: { increment: 1 }, lastError: null },
  });
  if (claim.count !== 1) {
    return { eventId: event.id, status: "IGNORED", reason: "already_claimed", duplicate: true, persisted: true };
  }

  try {
    const handled = await handleStripeEvent(event, context);
    await db.stripeEvent.update({
      where: { id: stored.id },
      data: {
        status: handled.status,
        processedAt: new Date(),
        invoiceId: handled.invoiceId,
        paymentId: handled.paymentId,
        stripeSubscriptionId: handled.stripeSubscriptionId,
        lastError: null,
      },
    });
    return { eventId: event.id, ...handled, duplicate: false, persisted: true };
  } catch (error) {
    await db.stripeEvent.update({
      where: { id: stored.id },
      data: { status: "FAILED", lastError: safeErrorMessage(error), processedAt: null },
    });
    throw error;
  }
}

async function findOrCreateStripeEvent(event: Stripe.Event, organizationId: string) {
  const key = { organizationId_stripeEventId: { organizationId, stripeEventId: event.id } };
  const existing = await db.stripeEvent.findUnique({ where: key });
  if (existing) return existing;
  try {
    return await db.stripeEvent.create({
      data: {
        organizationId,
        stripeEventId: event.id,
        type: event.type,
        apiVersion: stringValue(asRecord(event).api_version) ?? null,
        payload: JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    return db.stripeEvent.findUniqueOrThrow({ where: key });
  }
}

async function handleStripeEvent(event: Stripe.Event, context: ResolvedEventContext): Promise<HandledEvent> {
  if (!HANDLED_EVENT_TYPES.has(event.type)) return { status: "IGNORED", reason: "unsupported_event" };
  const object = asRecord(event.data.object);

  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event, object, context);
    case "payment_intent.succeeded":
      return handlePaymentIntentSucceeded(event, object, context);
    case "payment_intent.payment_failed":
      return handlePaymentIntentFailed(object, context);
    case "invoice.paid":
      return handleStripeInvoicePaid(event, object, context);
    case "invoice.payment_failed":
      return handleStripeInvoiceFailed(object, context);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return handleSubscription(event, object, context);
    default:
      return { status: "IGNORED", reason: "unsupported_event" };
  }
}

async function handleCheckoutCompleted(event: Stripe.Event, object: StripeRecord, context: ResolvedEventContext): Promise<HandledEvent> {
  if (!context.invoiceId) return { status: "IGNORED", reason: "invoice_not_linked" };
  const sessionId = stringValue(object.id);
  const paymentIntentId = stripeId(object.payment_intent);
  const customerId = stripeId(object.customer);
  const stripeInvoiceId = stripeId(object.invoice);
  const subscriptionId = stripeId(object.subscription);

  await updateInvoiceStripeLinks(context, {
    stripeCheckoutSessionId: sessionId,
    stripePaymentIntentId: paymentIntentId,
    stripeCustomerId: customerId,
    stripeInvoiceId,
    stripeSubscriptionId: subscriptionId,
  });

  if (object.payment_status !== "paid") return { status: "PROCESSED", invoiceId: context.invoiceId };
  const amountCents = numberValue(object.amount_total);
  if (!amountCents || amountCents <= 0) return { status: "PROCESSED", invoiceId: context.invoiceId };
  const payment = await recordStripePaymentFromEvent({
    event,
    context,
    amountCents,
    currency: stringValue(object.currency),
    paymentIntentId,
    externalPaymentId: paymentIntentId ?? sessionId,
    fallbackId: sessionId,
  });
  return { status: "PROCESSED", invoiceId: context.invoiceId, paymentId: payment.id };
}

async function handlePaymentIntentSucceeded(event: Stripe.Event, object: StripeRecord, context: ResolvedEventContext): Promise<HandledEvent> {
  if (!context.invoiceId) return { status: "IGNORED", reason: "invoice_not_linked" };
  const paymentIntentId = stringValue(object.id);
  if (!paymentIntentId) return { status: "IGNORED", reason: "payment_intent_id_missing" };
  await updateInvoiceStripeLinks(context, { stripePaymentIntentId: paymentIntentId, stripeCustomerId: stripeId(object.customer) });
  const amountCents = numberValue(object.amount_received) ?? numberValue(object.amount);
  if (!amountCents || amountCents <= 0) return { status: "PROCESSED", invoiceId: context.invoiceId };
  const payment = await recordStripePaymentFromEvent({
    event,
    context,
    amountCents,
    currency: stringValue(object.currency),
    paymentIntentId,
    externalPaymentId: paymentIntentId,
    fallbackId: paymentIntentId,
  });
  return { status: "PROCESSED", invoiceId: context.invoiceId, paymentId: payment.id };
}

async function handlePaymentIntentFailed(object: StripeRecord, context: ResolvedEventContext): Promise<HandledEvent> {
  if (!context.invoiceId) return { status: "IGNORED", reason: "invoice_not_linked" };
  await updateInvoiceStripeLinks(context, {
    stripePaymentIntentId: stringValue(object.id),
    stripeCustomerId: stripeId(object.customer),
  });
  return { status: "PROCESSED", invoiceId: context.invoiceId };
}

async function handleStripeInvoicePaid(event: Stripe.Event, object: StripeRecord, context: ResolvedEventContext): Promise<HandledEvent> {
  if (!context.invoiceId) {
    return context.subscriptionRecordId
      ? { status: "PROCESSED", stripeSubscriptionId: context.subscriptionRecordId }
      : { status: "IGNORED", reason: "invoice_not_linked" };
  }
  const stripeInvoiceId = stringValue(object.id);
  const paidPayment = latestPaidInvoicePayment(object);
  const paymentIntentId = paidPayment?.paymentIntentId ?? directPaymentIntentIdFromInvoice(object);
  await updateInvoiceStripeLinks(context, {
    stripeInvoiceId,
    stripePaymentIntentId: paymentIntentId,
    stripeCustomerId: stripeId(object.customer),
    stripeSubscriptionId: subscriptionIdFromObject(object),
  });
  const paidOutOfBand = object.paid_out_of_band === true || numberValue(object.amount_paid_off_stripe) === numberValue(object.amount_paid);
  if (!paidPayment && (paidOutOfBand || !paymentIntentId)) {
    return { status: "PROCESSED", invoiceId: context.invoiceId };
  }
  const amountCents = paidPayment?.amountCents ?? numberValue(object.amount_paid);
  if (!amountCents || amountCents <= 0) return { status: "PROCESSED", invoiceId: context.invoiceId };
  const payment = await recordStripePaymentFromEvent({
    event,
    context,
    amountCents,
    currency: paidPayment?.currency ?? stringValue(object.currency),
    paymentIntentId,
    externalPaymentId: paymentIntentId ?? paidPayment?.chargeId ?? paidPayment?.id,
    fallbackId: paidPayment?.id ?? stripeInvoiceId,
  });
  return { status: "PROCESSED", invoiceId: context.invoiceId, paymentId: payment.id };
}

async function handleStripeInvoiceFailed(object: StripeRecord, context: ResolvedEventContext): Promise<HandledEvent> {
  if (!context.invoiceId) {
    return context.subscriptionRecordId
      ? { status: "PROCESSED", stripeSubscriptionId: context.subscriptionRecordId }
      : { status: "IGNORED", reason: "invoice_not_linked" };
  }
  await updateInvoiceStripeLinks(context, {
    stripeInvoiceId: stringValue(object.id),
    stripePaymentIntentId: paymentIntentIdFromInvoice(object),
    stripeCustomerId: stripeId(object.customer),
    stripeSubscriptionId: subscriptionIdFromObject(object),
  });
  return { status: "PROCESSED", invoiceId: context.invoiceId };
}

async function handleSubscription(event: Stripe.Event, object: StripeRecord, context: ResolvedEventContext): Promise<HandledEvent> {
  const externalId = stringValue(object.id);
  const customerId = stripeId(object.customer);
  if (!externalId || !customerId) return { status: "IGNORED", reason: "subscription_identity_missing" };
  const metadata = metadataFrom(object);
  const relations = await validatedSubscriptionRelations(context, metadata, customerId);
  const firstItem = firstSubscriptionItem(object);
  const cancelledAt = epochDate(object.canceled_at) ?? (event.type === "customer.subscription.deleted" ? new Date(event.created * 1000) : null);
  const data = {
    stripeCustomerId: customerId,
    status: stringValue(object.status) ?? (event.type === "customer.subscription.deleted" ? "canceled" : "unknown"),
    priceId: stripeId(asRecord(firstItem).price),
    companyId: relations.companyId,
    contactId: relations.contactId,
    opportunityId: relations.opportunityId,
    currentPeriodStart: epochDate(object.current_period_start) ?? epochDate(asRecord(firstItem).current_period_start),
    currentPeriodEnd: epochDate(object.current_period_end) ?? epochDate(asRecord(firstItem).current_period_end),
    cancelAtPeriodEnd: object.cancel_at_period_end === true,
    cancelledAt,
    metadata: metadata as Prisma.InputJsonValue,
  };
  const subscription = await db.stripeSubscription.upsert({
    where: {
      organizationId_stripeSubscriptionId: {
        organizationId: context.organizationId,
        stripeSubscriptionId: externalId,
      },
    },
    create: {
      organizationId: context.organizationId,
      stripeSubscriptionId: externalId,
      ...data,
    },
    update: data,
  });
  if (relations.companyId) {
    await db.company.updateMany({
      where: { id: relations.companyId, organizationId: context.organizationId, stripeCustomerId: null },
      data: { stripeCustomerId: customerId },
    });
  }
  if (context.invoiceId) {
    await db.invoice.updateMany({
      where: { id: context.invoiceId, organizationId: context.organizationId },
      data: { stripeSubscriptionId: externalId, stripeCustomerId: customerId },
    });
  }
  return { status: "PROCESSED", invoiceId: context.invoiceId, stripeSubscriptionId: subscription.id };
}

async function recordStripePaymentFromEvent(input: {
  event: Stripe.Event;
  context: ResolvedEventContext;
  amountCents: number;
  currency?: string;
  paymentIntentId?: string;
  externalPaymentId?: string;
  fallbackId?: string;
}) {
  const invoice = await db.invoice.findFirst({
    where: { id: input.context.invoiceId, organizationId: input.context.organizationId },
    select: { id: true, currency: true },
  });
  if (!invoice) throw new NotFoundError("No s’ha trobat la factura vinculada al pagament");
  const currency = input.currency?.toUpperCase();
  if (!currency || currency !== invoice.currency.toUpperCase()) {
    throw new AppError("La moneda del pagament Stripe no coincideix amb la factura", "STRIPE_CURRENCY_MISMATCH", 422);
  }
  const idempotencyKey = stripePaymentIdempotencyKey(input.paymentIntentId, input.fallbackId);
  const existing = await findExistingStripePayment({
    organizationId: input.context.organizationId,
    invoiceId: invoice.id,
    amountCents: input.amountCents,
    currency,
    idempotencyKey,
    paymentIntentId: input.paymentIntentId,
    externalPaymentId: input.externalPaymentId,
  });
  if (existing) return existing;

  try {
    return await recordPayment({
      organizationId: input.context.organizationId,
      invoiceId: invoice.id,
      amountCents: input.amountCents,
      currency,
      method: "STRIPE",
      idempotencyKey,
      externalPaymentId: input.externalPaymentId,
      stripePaymentIntentId: input.paymentIntentId,
      metadata: {
        stripeEventId: input.event.id,
        stripeEventType: input.event.type,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const raced = await findExistingStripePayment({
      organizationId: input.context.organizationId,
      invoiceId: invoice.id,
      amountCents: input.amountCents,
      currency,
      idempotencyKey,
      paymentIntentId: input.paymentIntentId,
      externalPaymentId: input.externalPaymentId,
    });
    if (raced) return raced;
    throw error;
  }
}

async function findExistingStripePayment(input: {
  organizationId: string;
  invoiceId: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  paymentIntentId?: string;
  externalPaymentId?: string;
}) {
  const or: Prisma.PaymentWhereInput[] = [{ idempotencyKey: input.idempotencyKey }];
  if (input.paymentIntentId) or.push({ stripePaymentIntentId: input.paymentIntentId });
  if (input.externalPaymentId) or.push({ externalPaymentId: input.externalPaymentId });
  return db.payment.findFirst({
    where: {
      organizationId: input.organizationId,
      invoiceId: input.invoiceId,
      amountCents: input.amountCents,
      currency: input.currency,
      method: "STRIPE",
      status: "SUCCEEDED",
      OR: or,
    },
  });
}

async function updateInvoiceStripeLinks(
  context: ResolvedEventContext,
  links: {
    stripeCheckoutSessionId?: string;
    stripePaymentIntentId?: string;
    stripeCustomerId?: string;
    stripeInvoiceId?: string;
    stripeSubscriptionId?: string;
  },
) {
  if (!context.invoiceId) return;
  const { stripeCustomerId, ...invoiceLinks } = links;
  if (stripeCustomerId && context.companyId) {
    const company = await db.company.findFirst({
      where: { id: context.companyId, organizationId: context.organizationId },
      select: { stripeCustomerId: true },
    });
    if (!company) throw new NotFoundError("No s’ha trobat l’empresa vinculada a Stripe");
    if (company.stripeCustomerId && company.stripeCustomerId !== stripeCustomerId) {
      throw new AppError("El client Stripe no coincideix amb l’empresa de la factura", "STRIPE_CUSTOMER_MISMATCH", 422);
    }
    const linked = await db.company.updateMany({
      where: { id: context.companyId, organizationId: context.organizationId, stripeCustomerId: null },
      data: { stripeCustomerId },
    });
    if (!company.stripeCustomerId && linked.count !== 1) {
      const current = await db.company.findFirst({
        where: { id: context.companyId, organizationId: context.organizationId },
        select: { stripeCustomerId: true },
      });
      if (current?.stripeCustomerId !== stripeCustomerId) {
        throw new AppError("El client Stripe no coincideix amb l’empresa de la factura", "STRIPE_CUSTOMER_MISMATCH", 422);
      }
    }
  }

  const data = Object.fromEntries(
    Object.entries({ ...invoiceLinks, stripeCustomerId }).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ) as Prisma.InvoiceUpdateManyMutationInput;
  if (Object.keys(data).length) {
    await db.invoice.updateMany({
      where: { id: context.invoiceId, organizationId: context.organizationId },
      data,
    });
  }
}

async function validatedSubscriptionRelations(context: ResolvedEventContext, metadata: Record<string, string>, stripeCustomerId: string) {
  const companyCandidate = context.companyId ?? metadata.aimetosCompanyId;
  const contactCandidate = context.contactId ?? metadata.aimetosContactId;
  const opportunityCandidate = context.opportunityId ?? metadata.aimetosOpportunityId;
  const [company, contact, opportunity] = await Promise.all([
    companyCandidate
      ? db.company.findFirst({ where: { id: companyCandidate, organizationId: context.organizationId }, select: { id: true, stripeCustomerId: true } })
      : null,
    contactCandidate ? db.contact.findFirst({ where: { id: contactCandidate, organizationId: context.organizationId }, select: { id: true } }) : null,
    opportunityCandidate ? db.opportunity.findFirst({ where: { id: opportunityCandidate, organizationId: context.organizationId }, select: { id: true } }) : null,
  ]);
  if (company?.stripeCustomerId && company.stripeCustomerId !== stripeCustomerId) {
    throw new AppError("El client Stripe no coincideix amb l’empresa de la subscripció", "STRIPE_CUSTOMER_MISMATCH", 422);
  }
  return { companyId: company?.id ?? null, contactId: contact?.id ?? null, opportunityId: opportunity?.id ?? null };
}

async function resolveEventContext(event: Stripe.Event): Promise<ResolvedEventContext | null> {
  const object = asRecord(event.data.object);
  const metadata = metadataFrom(object);
  const metadataOrganizationId = metadata.aimetosOrganizationId;
  const metadataInvoiceId = metadata.aimetosInvoiceId ?? (event.type === "checkout.session.completed" ? stringValue(object.client_reference_id) : undefined);

  let invoice = metadataInvoiceId ? await db.invoice.findUnique({ where: { id: metadataInvoiceId }, select: invoiceContextSelect }) : null;
  if (invoice && metadataOrganizationId && invoice.organizationId !== metadataOrganizationId) {
    throw new AppError("Les metadades Stripe no coincideixen amb el tenant de la factura", "STRIPE_TENANT_MISMATCH", 422);
  }

  if (!invoice) {
    const lookup = stripeInvoiceLookup(event.type, object);
    if (lookup) invoice = await uniqueInvoice(lookup, metadataOrganizationId);
  }
  if (invoice) {
    return {
      organizationId: invoice.organizationId,
      invoiceId: invoice.id,
      companyId: invoice.companyId,
      contactId: invoice.contactId,
      opportunityId: invoice.opportunityId,
    };
  }

  const externalSubscriptionId = subscriptionIdFromObject(object) ?? (event.type.startsWith("customer.subscription.") ? stringValue(object.id) : undefined);
  if (externalSubscriptionId) {
    const subscriptions = await db.stripeSubscription.findMany({
      where: {
        stripeSubscriptionId: externalSubscriptionId,
        ...(metadataOrganizationId ? { organizationId: metadataOrganizationId } : {}),
      },
      select: { id: true, organizationId: true, companyId: true, contactId: true, opportunityId: true },
      take: 2,
    });
    if (subscriptions.length === 1) {
      const subscription = subscriptions[0];
      return {
        organizationId: subscription.organizationId,
        companyId: subscription.companyId,
        contactId: subscription.contactId,
        opportunityId: subscription.opportunityId,
        subscriptionRecordId: subscription.id,
      };
    }
  }

  const customerId = stripeId(object.customer);
  if (customerId) {
    const companies = await db.company.findMany({
      where: { stripeCustomerId: customerId, ...(metadataOrganizationId ? { organizationId: metadataOrganizationId } : {}) },
      select: { id: true, organizationId: true },
      take: 2,
    });
    if (companies.length === 1) return { organizationId: companies[0].organizationId, companyId: companies[0].id };
  }

  if (metadataOrganizationId) {
    const organization = await db.organization.findUnique({ where: { id: metadataOrganizationId }, select: { id: true } });
    if (organization) {
      return {
        organizationId: organization.id,
        companyId: metadata.aimetosCompanyId ?? null,
        contactId: metadata.aimetosContactId ?? null,
        opportunityId: metadata.aimetosOpportunityId ?? null,
      };
    }
  }
  return null;
}

const invoiceContextSelect = {
  id: true,
  organizationId: true,
  companyId: true,
  contactId: true,
  opportunityId: true,
} satisfies Prisma.InvoiceSelect;

function stripeInvoiceLookup(eventType: string, object: StripeRecord): Prisma.InvoiceWhereInput | null {
  if (eventType === "checkout.session.completed") {
    const id = stringValue(object.id);
    return id ? { stripeCheckoutSessionId: id } : null;
  }
  if (eventType.startsWith("payment_intent.")) {
    const id = stringValue(object.id);
    return id ? { stripePaymentIntentId: id } : null;
  }
  if (eventType.startsWith("invoice.")) {
    const id = stringValue(object.id);
    return id ? { stripeInvoiceId: id } : null;
  }
  return null;
}

async function uniqueInvoice(where: Prisma.InvoiceWhereInput, organizationId?: string) {
  const invoices = await db.invoice.findMany({
    where: { ...where, ...(organizationId ? { organizationId } : {}) },
    select: invoiceContextSelect,
    take: 2,
  });
  return invoices.length === 1 ? invoices[0] : null;
}

function metadataFrom(object: StripeRecord) {
  const direct = stringRecord(object.metadata);
  const subscriptionDetails = asRecord(asRecord(object.parent).subscription_details);
  return { ...stringRecord(subscriptionDetails.metadata), ...direct };
}

function subscriptionIdFromObject(object: StripeRecord) {
  return stripeId(object.subscription) ?? stripeId(asRecord(asRecord(object.parent).subscription_details).subscription);
}

function paymentIntentIdFromInvoice(object: StripeRecord) {
  const direct = directPaymentIntentIdFromInvoice(object);
  if (direct) return direct;
  const payments = asRecord(object.payments).data;
  if (!Array.isArray(payments)) return undefined;
  for (const candidate of payments) {
    const payment = asRecord(asRecord(candidate).payment);
    const id = stripeId(payment.payment_intent);
    if (id) return id;
  }
  return undefined;
}

function directPaymentIntentIdFromInvoice(object: StripeRecord) {
  return stripeId(object.payment_intent) ?? stripeId(asRecord(object.payment_settings).payment_intent);
}

function latestPaidInvoicePayment(object: StripeRecord) {
  const payments = asRecord(object.payments).data;
  if (!Array.isArray(payments)) return undefined;
  let latest:
    | {
        id: string;
        amountCents: number;
        currency?: string;
        paymentIntentId?: string;
        chargeId?: string;
        paidAt: number;
      }
    | undefined;

  for (const candidateValue of payments) {
    const candidate = asRecord(candidateValue);
    const id = stringValue(candidate.id);
    const amountCents = numberValue(candidate.amount_paid);
    const payment = asRecord(candidate.payment);
    const paymentIntentId = stripeId(payment.payment_intent);
    const chargeId = stripeId(payment.charge);
    if (candidate.status !== "paid" || !id || !amountCents || amountCents <= 0 || (!paymentIntentId && !chargeId)) continue;
    const paidAt = numberValue(asRecord(candidate.status_transitions).paid_at) ?? numberValue(candidate.created) ?? 0;
    if (!latest || paidAt >= latest.paidAt) {
      latest = {
        id,
        amountCents,
        currency: stringValue(candidate.currency),
        paymentIntentId,
        chargeId,
        paidAt,
      };
    }
  }
  return latest;
}

function firstSubscriptionItem(object: StripeRecord) {
  const data = asRecord(object.items).data;
  return Array.isArray(data) ? asRecord(data[0]) : {};
}

function asRecord(value: unknown): StripeRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as StripeRecord) : {};
}

function stringRecord(value: unknown) {
  return Object.fromEntries(
    Object.entries(asRecord(value)).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stripeId(value: unknown): string | undefined {
  return stringValue(value) ?? stringValue(asRecord(value).id);
}

function epochDate(value: unknown) {
  const seconds = numberValue(value);
  return seconds == null ? null : new Date(seconds * 1000);
}

function stripeErrorCode(error: unknown) {
  const direct = stringValue(asRecord(error).code);
  return direct ?? stringValue(asRecord(asRecord(error).raw).code);
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Error desconegut processant Stripe";
  return message
    .replace(/(?:(?:sk|rk|pk)_(?:test|live)|whsec)_[A-Za-z0-9_-]+/g, "[stripe-key-redacted]")
    .slice(0, 2_000);
}
