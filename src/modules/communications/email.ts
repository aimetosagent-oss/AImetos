import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export async function sendQueuedEmail(emailMessageId: string) {
  const message = await db.emailMessage.findUnique({ where: { id: emailMessageId } });
  if (!message || message.status === "SENT" || message.status === "CANCELLED") return;
  const config = env();
  if (!config.SMTP_HOST) throw new Error("SMTP_HOST no està configurat; el correu queda pendent per reintentar.");
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  await db.emailMessage.update({ where: { id: message.id }, data: { status: "PROCESSING", attempts: { increment: 1 } } });
  try {
    const sent = await transport.sendMail({
      from: { name: config.SMTP_FROM_NAME, address: config.SMTP_FROM_EMAIL },
      to: message.toAddress,
      cc: message.ccAddresses,
      bcc: message.bccAddresses,
      subject: message.subject,
      text: message.textBody,
      html: message.htmlBody,
      headers: { "X-Aimetos-Message-Id": message.id },
    });
    await db.$transaction([
      db.emailMessage.update({ where: { id: message.id }, data: { status: "SENT", sentAt: new Date(), providerMessageId: sent.messageId } }),
      db.activity.create({ data: { organizationId: message.organizationId, type: "EMAIL_SENT", summary: `Correu enviat: ${message.subject}`, contactId: message.contactId, quoteId: message.quoteId, invoiceId: message.invoiceId } }),
    ]);
  } catch (error) {
    await db.emailMessage.update({ where: { id: message.id }, data: { status: "FAILED", lastError: error instanceof Error ? error.message.slice(0, 4_000) : "Error SMTP" } });
    throw error;
  }
}
