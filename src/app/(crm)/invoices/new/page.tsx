import { Button, ButtonLink, Card, CardContent, Field, FormActions, FormGrid, FormSection, Input, PageHeader, Select, Textarea } from "@/components";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { createInvoiceAction } from "../../document-actions";

export default async function NewInvoicePage() {
  const context = await requireTenant();
  const [companies, contacts, opportunities, products, settings] = await Promise.all([
    db.company.findMany({ where: { organizationId: context.organizationId, deletedAt: null }, orderBy: { name: "asc" } }),
    db.contact.findMany({ where: { organizationId: context.organizationId, deletedAt: null }, orderBy: { firstName: "asc" } }),
    db.opportunity.findMany({ where: { organizationId: context.organizationId, deletedAt: null }, orderBy: { updatedAt: "desc" } }),
    db.product.findMany({ where: { organizationId: context.organizationId, deletedAt: null, isActive: true }, orderBy: { name: "asc" } }),
    db.organizationSettings.findUnique({ where: { organizationId: context.organizationId } }),
  ]);
  return (
    <div className="page-stack">
      <PageHeader title="Nova factura" description="Factura comercial amb càlcul segur en cèntims i numeració correlativa." breadcrumbs={[{ label: "Factures", href: "/invoices" }, { label: "Nova" }]} />
      <form action={createInvoiceAction}><Card><CardContent>
        <FormSection title="Client i oportunitat"><FormGrid>
          <Field label="Empresa" htmlFor="companyId" required><Select id="companyId" name="companyId" required defaultValue=""><option value="" disabled>Selecciona una empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</Select></Field>
          <Field label="Contacte" htmlFor="contactId"><Select id="contactId" name="contactId" defaultValue=""><option value="">Sense contacte</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}</option>)}</Select></Field>
          <Field label="Oportunitat" htmlFor="opportunityId"><Select id="opportunityId" name="opportunityId" defaultValue=""><option value="">Sense oportunitat</option>{opportunities.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunity.title}</option>)}</Select></Field>
        </FormGrid></FormSection>
        <FormSection title="Línia de factura"><FormGrid>
          <Field label="Producte de referència" htmlFor="productId"><Select id="productId" name="productId" defaultValue=""><option value="">Línia manual</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {(product.unitPriceCents / 100).toFixed(2)} {product.currency}</option>)}</Select></Field>
          <Field label="Descripció" htmlFor="description" required><Input id="description" name="description" required /></Field>
          <Field label="Quantitat" htmlFor="quantity" required><Input id="quantity" name="quantity" type="number" min="1" step="1" defaultValue="1" required /></Field>
          <Field label="Preu unitari (€)" htmlFor="unitPrice" required><Input id="unitPrice" name="unitPrice" inputMode="decimal" required placeholder="0,00" /></Field>
          <Field label="IVA (%)" htmlFor="taxRate" required><Input id="taxRate" name="taxRate" type="number" min="0" max="100" step="0.01" defaultValue={(settings?.defaultTaxRateBps ?? 2100) / 100} required /></Field>
        </FormGrid></FormSection>
        <FormSection title="Notes i condicions"><FormGrid><Field label="Notes" htmlFor="notes"><Textarea id="notes" name="notes" rows={4} /></Field><Field label="Condicions" htmlFor="terms"><Textarea id="terms" name="terms" rows={4} defaultValue={`Pagament a ${settings?.invoiceDueDays ?? 30} dies des de l’emissió.`} /></Field></FormGrid></FormSection>
      </CardContent><FormActions><ButtonLink href="/invoices" variant="ghost">Cancel·lar</ButtonLink><Button type="submit">Crear factura</Button></FormActions></Card></form>
    </div>
  );
}
