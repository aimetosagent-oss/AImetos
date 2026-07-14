import { UserRoundPlus } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FormActions, FormSection, Input, Select, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

import { createContactAction } from "../../actions";

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; error?: string }>;
}) {
  const { organizationId } = await requireTenant();
  const { companyId, error } = await searchParams;
  const companies = await db.company.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={[{ label: "Contactes", href: "/contacts" }, { label: "Nou contacte" }]}
        title="Crea un contacte"
        description="Registra una persona i associa-la opcionalment a una empresa."
      />
      {error ? <div className="kanban-alert" role="alert">{error}</div> : null}
      <Card>
        <CardContent>
          <form action={createContactAction}>
            <FormSection title="Identitat" description="Dades bàsiques de la persona.">
              <Field label="Nom" htmlFor="firstName" required><Input id="firstName" name="firstName" required autoFocus /></Field>
              <Field label="Cognoms" htmlFor="lastName"><Input id="lastName" name="lastName" /></Field>
              <Field label="Càrrec" htmlFor="position"><Input id="position" name="position" /></Field>
              <Field label="Empresa" htmlFor="companyId">
                <Select id="companyId" name="companyId" defaultValue={companyId || ""}>
                  <option value="">Sense empresa</option>
                  {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </Select>
              </Field>
            </FormSection>
            <FormSection title="Contacte" description="Canals per comunicar-nos amb aquesta persona.">
              <Field label="Correu electrònic" htmlFor="email"><Input id="email" name="email" type="email" /></Field>
              <Field label="Telèfon" htmlFor="phone"><Input id="phone" name="phone" type="tel" /></Field>
              <Field label="Idioma preferit" htmlFor="preferredLanguage"><Select id="preferredLanguage" name="preferredLanguage" defaultValue="ca"><option value="ca">Català</option><option value="es">Castellà</option><option value="en">Anglès</option></Select></Field>
              <Field label="Origen" htmlFor="source"><Input id="source" name="source" placeholder="Formulari, referència…" /></Field>
            </FormSection>
            <FormSection title="Context intern" description="Informació visible només per l’equip.">
              <Field className="form-field--full" label="Notes" htmlFor="notesText"><Textarea id="notesText" name="notesText" rows={5} /></Field>
            </FormSection>
            <FormActions>
              <ButtonLink href="/contacts" variant="ghost">Cancel·la</ButtonLink>
              <Button type="submit"><UserRoundPlus size={17} /> Desa el contacte</Button>
            </FormActions>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
