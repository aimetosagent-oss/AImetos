import { CheckSquare2 } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FormActions, FormSection, Input, Select, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

import { createTaskAction } from "../../actions";

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const context = await requireTenant();
  const { error } = await searchParams;
  const [members, companies, contacts, opportunities] = await Promise.all([
    db.membership.findMany({ where: { organizationId: context.organizationId, isActive: true }, include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } }),
    db.company.findMany({ where: { organizationId: context.organizationId, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.contact.findMany({ where: { organizationId: context.organizationId, deletedAt: null }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
    db.opportunity.findMany({ where: { organizationId: context.organizationId, deletedAt: null, status: "OPEN" }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true } }),
  ]);
  return (
    <div className="page-stack">
      <PageHeader breadcrumbs={[{ label: "Tasques", href: "/tasks" }, { label: "Nova tasca" }]} title="Crea una tasca" description="Programa un seguiment i relaciona’l amb el context comercial correcte." />
      {error ? <div className="kanban-alert" role="alert">{error}</div> : null}
      <Card>
        <CardContent>
          <form action={createTaskAction}>
            <FormSection title="Tasca" description="Què cal fer i amb quina prioritat.">
              <Field className="form-field--full" label="Títol" htmlFor="title" required><Input id="title" name="title" required autoFocus /></Field>
              <Field className="form-field--full" label="Descripció" htmlFor="description"><Textarea id="description" name="description" rows={4} /></Field>
              <Field label="Prioritat" htmlFor="priority"><Select id="priority" name="priority" defaultValue="NORMAL"><option value="LOW">Baixa</option><option value="NORMAL">Normal</option><option value="HIGH">Alta</option><option value="URGENT">Urgent</option></Select></Field>
              <Field label="Venciment" htmlFor="dueAt"><Input id="dueAt" name="dueAt" type="datetime-local" /></Field>
              <Field label="Responsable" htmlFor="assignedToId"><Select id="assignedToId" name="assignedToId" defaultValue={context.userId}>{members.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name}</option>)}</Select></Field>
            </FormSection>
            <FormSection title="Relacions" description="Pots associar la tasca a un o més elements.">
              <Field label="Empresa" htmlFor="companyId"><Select id="companyId" name="companyId"><option value="">Sense empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</Select></Field>
              <Field label="Contacte" htmlFor="contactId"><Select id="contactId" name="contactId"><option value="">Sense contacte</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{[contact.firstName, contact.lastName].filter(Boolean).join(" ")}</option>)}</Select></Field>
              <Field className="form-field--full" label="Oportunitat" htmlFor="opportunityId"><Select id="opportunityId" name="opportunityId"><option value="">Sense oportunitat</option>{opportunities.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunity.title}</option>)}</Select></Field>
            </FormSection>
            <FormActions><ButtonLink href="/tasks" variant="ghost">Cancel·la</ButtonLink><Button type="submit"><CheckSquare2 size={17} /> Desa la tasca</Button></FormActions>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
