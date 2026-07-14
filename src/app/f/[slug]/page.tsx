import Image from "next/image";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PublicForm } from "@/modules/forms/public-form";

export const dynamic = "force-dynamic";

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const form = await db.form.findFirst({
    where: { slug, isActive: true, archivedAt: null },
    include: { fields: { orderBy: { position: "asc" } } },
  });
  if (!form) notFound();
  return (
    <main className="public-shell">
      <section className="public-card public-form-card">
        <header className="public-brand">
          <Image src="/brand/logo-web.png" alt="AImetos" width={189} height={62} priority />
          <span>Formulari segur</span>
        </header>
        <div className="public-heading">
          <p className="eyebrow">Parlem del teu projecte</p>
          <h1>{form.name}</h1>
          {form.description ? <p>{form.description}</p> : null}
        </div>
        <PublicForm slug={form.slug} fields={form.fields} consentText={form.consentText} />
      </section>
      <p className="public-footer">Les dades només s’utilitzaran per respondre la teva sol·licitud.</p>
    </main>
  );
}
