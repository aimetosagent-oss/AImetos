import Image from "next/image";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { Download, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { decideQuote, markQuoteViewed } from "@/modules/documents/quotes";

export const dynamic = "force-dynamic";

const statusLabel = { DRAFT: "Esborrany", SENT: "Enviat", VIEWED: "Vist", ACCEPTED: "Acceptat", REJECTED: "Rebutjat", EXPIRED: "Caducat", CANCELLED: "Cancel·lat" } as const;

export default async function QuotePublicPage({ params }: { params: Promise<{ publicToken: string }> }) {
  const { publicToken } = await params;
  try {
    await markQuoteViewed(publicToken);
  } catch {
    notFound();
  }
  const quote = await db.quote.findUnique({
    where: { publicToken },
    include: { company: true, contact: true, items: { orderBy: { position: "asc" } }, organization: { include: { settings: true } } },
  });
  if (!quote?.organization.settings) notFound();

  async function accept(formData: FormData) {
    "use server";
    const decided = await decideQuote(publicToken, "accept", String(formData.get("comment") ?? ""));
    revalidatePath(`/q/${publicToken}`);
    revalidatePath(`/quotes/${decided.id}`);
  }
  async function reject(formData: FormData) {
    "use server";
    const decided = await decideQuote(publicToken, "reject", String(formData.get("comment") ?? ""));
    revalidatePath(`/q/${publicToken}`);
    revalidatePath(`/quotes/${decided.id}`);
  }

  const canDecide = ["SENT", "VIEWED"].includes(quote.status);
  return (
    <main className="document-public-shell">
      <section className="document-public-card">
        <header className="document-public-header">
          <Image src="/brand/logo-web.png" alt="AImetos" width={189} height={62} priority />
          <div>
            <span className={`document-status status-${quote.status.toLowerCase()}`}>{statusLabel[quote.status]}</span>
            <p>Pressupost</p>
            <h1>{quote.number}</h1>
          </div>
        </header>
        <div className="document-meta-grid">
          <div>
            <span>Emissor</span>
            <strong>{quote.organization.settings.tradeName}</strong>
            <p>{quote.organization.settings.legalName}</p>
            <p>{quote.organization.settings.taxId}</p>
          </div>
          <div>
            <span>Client</span>
            <strong>{quote.company.name}</strong>
            <p>{quote.contact ? `${quote.contact.firstName} ${quote.contact.lastName ?? ""}` : quote.company.email}</p>
            <p>{quote.company.taxId}</p>
          </div>
          <div>
            <span>Data d’emissió</span>
            <strong>{quote.issueDate.toLocaleDateString("ca-ES")}</strong>
          </div>
          <div>
            <span>Vàlid fins al</span>
            <strong>{quote.validUntil.toLocaleDateString("ca-ES")}</strong>
          </div>
        </div>
        <div className="document-table-wrap">
          <table className="document-table">
            <thead><tr><th>Descripció</th><th>Quantitat</th><th>Preu</th><th>IVA</th><th>Total</th></tr></thead>
            <tbody>
              {quote.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>{formatMoney(item.unitPriceCents, quote.currency)}</td>
                  <td>{item.taxRateBps / 100}%</td>
                  <td>{formatMoney(item.totalCents, quote.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="document-summary">
          <dl>
            <div><dt>Subtotal</dt><dd>{formatMoney(quote.subtotalCents, quote.currency)}</dd></div>
            {quote.discountAmountCents ? <div><dt>Descompte</dt><dd>−{formatMoney(quote.discountAmountCents, quote.currency)}</dd></div> : null}
            <div><dt>Impostos</dt><dd>{formatMoney(quote.taxAmountCents, quote.currency)}</dd></div>
            <div className="document-total"><dt>Total</dt><dd>{formatMoney(quote.totalCents, quote.currency)}</dd></div>
          </dl>
        </div>
        {quote.notesText || quote.terms ? <div className="document-copy-grid">{quote.notesText ? <div><h2>Notes</h2><p>{quote.notesText}</p></div> : null}{quote.terms ? <div><h2>Condicions</h2><p>{quote.terms}</p></div> : null}</div> : null}
        <footer className="document-actions">
          <Link className="button button-secondary" href={`/q/${publicToken}/pdf`} target="_blank"><Download size={17} /> Descarregar PDF</Link>
          {canDecide ? (
            <form className="document-decision">
              <label htmlFor="decision-comment">Comentari opcional</label>
              <textarea id="decision-comment" name="comment" placeholder="Afegeix una observació…" />
              <div>
                <button className="button button-danger" type="submit" formAction={reject}>Rebutjar</button>
                <button className="button button-primary" type="submit" formAction={accept}>Acceptar pressupost</button>
              </div>
            </form>
          ) : quote.status === "ACCEPTED" ? <div className="document-confirmation"><ShieldCheck size={20} /> Pressupost acceptat correctament</div> : null}
        </footer>
      </section>
      <p className="public-footer">Document segur facilitat per AImetos.</p>
    </main>
  );
}
