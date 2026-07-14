import { PackagePlus } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckboxField, Field, FormActions, FormSection, Input, Select, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";

import { createProductAction } from "../../actions";

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="page-stack">
      <PageHeader breadcrumbs={[{ label: "Productes", href: "/products" }, { label: "Nou producte" }]} title="Crea un producte o servei" description="El catàleg funciona amb o sense integració de Stripe." />
      {error ? <div className="kanban-alert" role="alert">{error}</div> : null}
      <Card>
        <CardContent>
          <form action={createProductAction}>
            <FormSection title="Producte" description="Informació que apareixerà als documents.">
              <Field label="Nom" htmlFor="name" required><Input id="name" name="name" required autoFocus /></Field>
              <Field label="SKU" htmlFor="sku" required><Input id="sku" name="sku" required /></Field>
              <Field className="form-field--full" label="Descripció" htmlFor="description"><Textarea id="description" name="description" rows={4} /></Field>
            </FormSection>
            <FormSection title="Preu i impostos" description="Imports base calculats sempre al servidor.">
              <Field label="Preu unitari" htmlFor="unitPrice" required><Input id="unitPrice" name="unitPrice" type="number" min="0" step="0.01" required /></Field>
              <Field label="Moneda" htmlFor="currency"><Input id="currency" name="currency" defaultValue="EUR" maxLength={3} /></Field>
              <Field label="IVA (%)" htmlFor="taxRate"><Input id="taxRate" name="taxRate" type="number" min="0" max="100" step="0.01" defaultValue="21" /></Field>
              <Field label="Tipus de facturació" htmlFor="billingType"><Select id="billingType" name="billingType" defaultValue="ONE_TIME"><option value="ONE_TIME">Pagament únic</option><option value="RECURRING">Recurrent</option></Select></Field>
              <CheckboxField name="isActive" label="Producte actiu" description="Disponible per afegir a pressupostos i factures." defaultChecked />
            </FormSection>
            <FormActions><ButtonLink href="/products" variant="ghost">Cancel·la</ButtonLink><Button type="submit"><PackagePlus size={17} /> Desa el producte</Button></FormActions>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
