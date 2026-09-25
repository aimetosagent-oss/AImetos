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
          <span>Formulario seguro</span>
        </header>
        <div className="public-heading">
          <p className="eyebrow">Hablemos de tu proyecto</p>
          <h1>{form.name}</h1>
          {form.description ? <p>{form.description}</p> : null}
        </div>
        <PublicForm slug={form.slug} fields={form.fields} consentText={form.consentText} submitLabel={form.submitLabel} />
      </section>
      <p className="public-footer">
        Los datos solo se utilizarán para responder a tu solicitud.<br />
        <a href="https://aimetos.com/politica-de-privacidad">Política de privacidad</a>
        <span> · </span>
        <a href="https://aimetos.com/terminos-de-servicio">Términos de servicio</a>
      </p>
    </main>
  );
}
