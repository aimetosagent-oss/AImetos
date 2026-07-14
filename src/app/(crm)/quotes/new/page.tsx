import { Button, ButtonLink, Card, CardContent, Field, FormActions, FormGrid, FormSection, Input, PageHeader, Select, Textarea } from "@/components";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { createQuoteAction } from "../../document-actions";

export default async function NewQuotePage() {
  const context = await requireTenant();
  const [companies, contacts, opportunities, products, settings] = await Promise.all([
    db.company.findMany({ where: { organizationId: context.organizationId, deletedAt: null }, orderBy: { name: "asc" } }),
    db.contact.findMany({ where: { organizationId: context.organizationId, deletedAt: null }, orderBy: { firstName: "asc" } }),
    db.opportunity.findMany({ where: { organizationId: context.organizationId, deletedAt: null, status: "OPEN" }, orderBy: { updatedAt: "desc" } }),
    db.product.findMany({ where: { organizationId: context.organizationId, deletedAt: null, isActive: true }, orderBy: { name: "asc" } }),
    db.organizationSettings.findUnique({ where: { organizationId: context.organizationId } }),
  ]);
  return (
    <div className="page-stack">
      <PageHeader title="Nou pressupost" description="Els imports i els impostos es recalculen sempre al servidor." breadcrumbs={[{ label: "Pressupostos", href: "/quotes" }, { label: "Nou" }]} />
      <form action={createQuoteAction}>
        <Card>
          <CardContent>
            <FormSection title="Client i oportunitat" description="Associa la proposta al context comercial correcte.">
              <FormGrid>
                <Field label="Empresa" htmlFor="companyId" required><Select id="companyId" name="companyId" required defaultValue=""><option value="" disabled>Selecciona una empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</Select></Field>
                <Field label="Contacte" htmlFor="contactId"><Select id="contactId" name="contactId" defaultValue=""><option value="">Sense contacte</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}</option>)}</Select></Field>
                <Field label="Oportunitat" htmlFor="opportunityId"><Select id="opportunityId" name="opportunityId" defaultValue=""><option value="">Sense oportunitat</option>{opportunities.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunity.title}</option>)}</Select></Field>
              </FormGrid>
            </FormSection>
            <FormSection title="Línia del pressupost" description="Pots partir d’un producte del catàleg o escriure una línia manual.">
              <FormGrid>
                <Field label="Producte de referència" htmlFor="productId"><Select id="productId" name="productId" defaultValue=""><option value="">Línia manual</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {(product.unitPriceCents / 100).toFixed(2)} {product.currency}</option>)}</Select></Field>
                <Field label="Descripció" htmlFor="description" required><Input id="description" name="description" required placeholder="Servei o producte" /></Field>
                <Field label="Quantitat" htmlFor="quantity" required><Input id="quantity" name="quantity" type="number" min="1" step="1" defaultValue="1" required /></Field>
                <Field label="Preu unitari (€)" htmlFor="unitPrice" required><Input id="unitPrice" name="unitPrice" inputMode="decimal" placeholder="0,00" required /></Field>
                <Field label="IVA (%)" htmlFor="taxRate" required><Input id="taxRate" name="taxRate" type="number" min="0" max="100" step="0.01" defaultValue={(settings?.defaultTaxRateBps ?? 2100) / 100} required /></Field>
              </FormGrid>
            </FormSection>
            <FormSection title="Notes i condicions"><FormGrid><Field label="Notes" htmlFor="notes"><Textarea id="notes" name="notes" rows={4} /></Field><Field label="Condicions" htmlFor="terms"><Textarea id="terms" name="terms" rows={4} defaultValue="Validesa indicada al document. Els treballs s’iniciaran després de l’acceptació." /></Field></FormGrid></FormSection>
          </CardContent>
          <FormActions><ButtonLink href="/quotes" variant="ghost">Cancel·lar</ButtonLink><Button type="submit">Crear pressupost</Button></FormActions>
        </Card>
      </form>
    </div>
  );
}
