import { formatMoney } from "@/lib/money";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

function layout(title: string, content: string, action?: { label: string; url: string }) {
  const button = action
    ? `<p style="margin:28px 0"><a href="${escapeHtml(action.url)}" style="background:#087f8c;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">${escapeHtml(action.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="ca"><body style="margin:0;background:#f4f7f8;font-family:Arial,sans-serif;color:#172b34"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" style="max-width:600px;background:#fff;border:1px solid #dfe8eb;border-radius:12px"><tr><td style="padding:32px"><p style="color:#087f8c;font-weight:700;margin:0 0 20px">AImetos</p><h1 style="font-size:24px;margin:0 0 18px">${escapeHtml(title)}</h1>${content}${button}<p style="color:#6b7d85;font-size:13px;margin:30px 0 0">Aquest correu s’ha generat des de l’AImetos CRM.</p></td></tr></table></td></tr></table></body></html>`;
}

export function quoteSentTemplate(input: { clientName: string; number: string; totalCents: number; currency: string; url: string; validUntil: Date }) {
  const title = `Pressupost ${input.number}`;
  const text = `Hola ${input.clientName},\n\nJa pots consultar el pressupost ${input.number}, per un total de ${formatMoney(input.totalCents, input.currency)}. És vàlid fins al ${input.validUntil.toLocaleDateString("ca-ES")}.\n\n${input.url}\n\nAImetos`;
  return {
    subject: `${title} · AImetos`,
    text,
    html: layout(
      title,
      `<p>Hola ${escapeHtml(input.clientName)},</p><p>Ja pots consultar el pressupost <strong>${escapeHtml(input.number)}</strong>, per un total de <strong>${escapeHtml(formatMoney(input.totalCents, input.currency))}</strong>.</p><p>És vàlid fins al ${escapeHtml(input.validUntil.toLocaleDateString("ca-ES"))}.</p>`,
      { label: "Veure el pressupost", url: input.url },
    ),
  };
}

export function quoteReminderTemplate(input: { clientName: string; number: string; url: string }) {
  return {
    subject: `Recordatori del pressupost ${input.number}`,
    text: `Hola ${input.clientName},\n\nEt recordem que pots revisar el pressupost ${input.number}:\n${input.url}\n\nAImetos`,
    html: layout(`Recordatori del pressupost ${input.number}`, `<p>Hola ${escapeHtml(input.clientName)},</p><p>Et recordem que el pressupost continua disponible per revisar.</p>`, { label: "Revisar el pressupost", url: input.url }),
  };
}

export function invoiceSentTemplate(input: { clientName: string; number: string; totalCents: number; currency: string; dueDate: Date; url: string }) {
  return {
    subject: `Factura ${input.number} · AImetos`,
    text: `Hola ${input.clientName},\n\nPots consultar la factura ${input.number}, per un total de ${formatMoney(input.totalCents, input.currency)}, amb venciment ${input.dueDate.toLocaleDateString("ca-ES")}.\n\n${input.url}\n\nAImetos`,
    html: layout(
      `Factura ${input.number}`,
      `<p>Hola ${escapeHtml(input.clientName)},</p><p>Ja pots consultar la factura per un total de <strong>${escapeHtml(formatMoney(input.totalCents, input.currency))}</strong>.</p><p>Venciment: ${escapeHtml(input.dueDate.toLocaleDateString("ca-ES"))}.</p>`,
      { label: "Veure la factura", url: input.url },
    ),
  };
}

export function invoiceReminderTemplate(input: { clientName: string; number: string; remainingCents: number; currency: string; url: string; overdue: boolean }) {
  const label = input.overdue ? "Factura vençuda" : "Recordatori de factura";
  return {
    subject: `${label} ${input.number}`,
    text: `Hola ${input.clientName},\n\nResta pendent ${formatMoney(input.remainingCents, input.currency)} de la factura ${input.number}.\n${input.url}\n\nAImetos`,
    html: layout(`${label} ${input.number}`, `<p>Hola ${escapeHtml(input.clientName)},</p><p>Resta pendent <strong>${escapeHtml(formatMoney(input.remainingCents, input.currency))}</strong>.</p>`, { label: "Consultar la factura", url: input.url }),
  };
}

export function paymentConfirmationTemplate(input: { clientName: string; number: string; amountCents: number; currency: string; url: string }) {
  return {
    subject: `Pagament rebut · Factura ${input.number}`,
    text: `Hola ${input.clientName},\n\nHem rebut el pagament de ${formatMoney(input.amountCents, input.currency)} corresponent a la factura ${input.number}.\n${input.url}\n\nGràcies,\nAImetos`,
    html: layout("Pagament rebut", `<p>Hola ${escapeHtml(input.clientName)},</p><p>Hem rebut el pagament de <strong>${escapeHtml(formatMoney(input.amountCents, input.currency))}</strong> corresponent a la factura ${escapeHtml(input.number)}.</p>`, { label: "Veure la factura", url: input.url }),
  };
}
