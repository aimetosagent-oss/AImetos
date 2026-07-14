import { Building2 } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FormActions, FormSection, Input, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";

import { createCompanyAction } from "../../actions";

export default async function NewCompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={[{ label: "Empreses", href: "/companies" }, { label: "Nova empresa" }]}
        title="Crea una empresa"
        description="Afegeix les dades bàsiques. Podràs relacionar-hi contactes i oportunitats immediatament."
      />
      {error ? <div className="kanban-alert" role="alert">{error}</div> : null}
      <Card>
        <CardContent>
          <form action={createCompanyAction}>
            <FormSection title="Identitat" description="Nom comercial i dades fiscals de l’empresa.">
              <Field label="Nom comercial" htmlFor="name" required><Input id="name" name="name" required autoFocus /></Field>
              <Field label="Raó social" htmlFor="legalName"><Input id="legalName" name="legalName" /></Field>
              <Field label="NIF" htmlFor="taxId"><Input id="taxId" name="taxId" /></Field>
              <Field label="Sector" htmlFor="sector"><Input id="sector" name="sector" /></Field>
            </FormSection>
            <FormSection title="Contacte" description="Canals generals i presència digital.">
              <Field label="Correu electrònic" htmlFor="email"><Input id="email" name="email" type="email" /></Field>
              <Field label="Telèfon" htmlFor="phone"><Input id="phone" name="phone" type="tel" /></Field>
              <Field label="Web" htmlFor="website"><Input id="website" name="website" type="url" placeholder="https://" /></Field>
              <Field label="Origen" htmlFor="source"><Input id="source" name="source" placeholder="Recomanació, formulari…" /></Field>
            </FormSection>
            <FormSection title="Adreça" description="Ubicació principal de l’empresa.">
              <Field className="form-field--full" label="Adreça" htmlFor="address"><Input id="address" name="address" /></Field>
              <Field label="Ciutat" htmlFor="city"><Input id="city" name="city" /></Field>
              <Field label="Codi postal" htmlFor="postalCode"><Input id="postalCode" name="postalCode" /></Field>
              <Field label="País" htmlFor="country"><Input id="country" name="country" defaultValue="ES" maxLength={2} /></Field>
            </FormSection>
            <FormSection title="Context intern" description="Informació visible només per l’equip.">
              <Field className="form-field--full" label="Notes" htmlFor="notesText"><Textarea id="notesText" name="notesText" rows={5} /></Field>
            </FormSection>
            <FormActions>
              <ButtonLink href="/companies" variant="ghost">Cancel·la</ButtonLink>
              <Button type="submit"><Building2 size={17} /> Desa l’empresa</Button>
            </FormActions>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
