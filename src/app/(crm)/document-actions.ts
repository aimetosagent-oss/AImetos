"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { createInvoice, convertQuoteToInvoice, recordPayment, sendInvoice } from "@/modules/documents/invoices";
import { createQuote, sendQuote } from "@/modules/documents/quotes";

const documentSchema = z.object({
  companyId: z.string().min(1),
  contactId: z.string().optional(),
  opportunityId: z.string().optional(),
  productId: z.string().optional(),
  description: z.string().trim().min(2).max(2_000),
  quantity: z.coerce.number().int().min(1).max(10_000),
  unitPrice: z.string().trim().min(1),
  taxRate: z.coerce.number().min(0).max(100),
  notes: z.string().max(10_000).optional(),
  terms: z.string().max(10_000).optional(),
});

function moneyToCents(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Import no vàlid");
  return Math.round(amount * 100);
}

export async function createQuoteAction(formData: FormData) {
  const context = await requireTenant();
  const parsed = documentSchema.parse(Object.fromEntries(formData));
  const quote = await createQuote(context, {
    companyId: parsed.companyId,
    contactId: parsed.contactId || null,
    opportunityId: parsed.opportunityId || null,
    notes: parsed.notes,
    terms: parsed.terms,
    lines: [{ description: parsed.description, quantity: parsed.quantity, unitPriceCents: moneyToCents(parsed.unitPrice), taxRateBps: Math.round(parsed.taxRate * 100), productId: parsed.productId || null }],
  });
  revalidatePath("/quotes");
  redirect(`/quotes/${quote.id}`);
}

export async function sendQuoteAction(formData: FormData) {
  const context = await requireTenant();
  const id = z.string().min(1).parse(formData.get("id"));
  await sendQuote(context, id);
  revalidatePath(`/quotes/${id}`);
  revalidatePath("/pipeline");
}

export async function duplicateQuoteAction(formData: FormData) {
  const context = await requireTenant();
  const id = z.string().min(1).parse(formData.get("id"));
  const source = await db.quote.findFirst({ where: { id, organizationId: context.organizationId }, include: { items: { orderBy: { position: "asc" } } } });
  if (!source) throw new Error("Pressupost no trobat");
  const quote = await createQuote(context, {
    companyId: source.companyId,
    contactId: source.contactId,
    opportunityId: source.opportunityId,
    currency: source.currency,
    notes: source.notesText,
    terms: source.terms,
    lines: source.items.map((line) => ({ description: line.description, quantity: line.quantity, unitPriceCents: line.unitPriceCents, discountBps: line.discountBps, taxRateBps: line.taxRateBps, productId: line.productId })),
  });
  redirect(`/quotes/${quote.id}`);
}

export async function convertQuoteAction(formData: FormData) {
  const context = await requireTenant();
  const id = z.string().min(1).parse(formData.get("id"));
  const invoice = await convertQuoteToInvoice(context, id);
  revalidatePath("/quotes");
  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

export async function createInvoiceAction(formData: FormData) {
  const context = await requireTenant();
  const parsed = documentSchema.parse(Object.fromEntries(formData));
  const invoice = await createInvoice(context, {
    companyId: parsed.companyId,
    contactId: parsed.contactId || null,
    opportunityId: parsed.opportunityId || null,
    notes: parsed.notes,
    terms: parsed.terms,
    lines: [{ description: parsed.description, quantity: parsed.quantity, unitPriceCents: moneyToCents(parsed.unitPrice), taxRateBps: Math.round(parsed.taxRate * 100), productId: parsed.productId || null }],
  });
  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

export async function sendInvoiceAction(formData: FormData) {
  const context = await requireTenant();
  const id = z.string().min(1).parse(formData.get("id"));
  await sendInvoice(context, id);
  revalidatePath(`/invoices/${id}`);
}

export async function manualPaymentAction(formData: FormData) {
  const context = await requireTenant();
  const id = z.string().min(1).parse(formData.get("id"));
  const submittedIdempotencyKey = z.string().uuid().parse(formData.get("idempotencyKey"));
  const invoice = await db.invoice.findFirst({ where: { id, organizationId: context.organizationId } });
  if (!invoice) throw new Error("Factura no trobada");
  const amountCents = moneyToCents(z.string().min(1).parse(formData.get("amount")));
  await recordPayment({
    organizationId: context.organizationId,
    invoiceId: invoice.id,
    amountCents,
    currency: invoice.currency,
    method: "MANUAL",
    idempotencyKey: `manual:${invoice.id}:${submittedIdempotencyKey}`,
    recordedById: context.userId,
    metadata: { note: String(formData.get("note") ?? "") },
  });
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
}
