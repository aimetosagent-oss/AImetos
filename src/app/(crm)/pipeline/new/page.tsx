import { BriefcaseBusiness } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FormActions, FormSection, Input, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

import { createOpportunityAction } from "../../actions";

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; companyId?: string; contactId?: string }>;
}) {
  const { organizationId } = await requireTenant();
  const { error, companyId, contactId } = await searchParams;
  const [pipelines, companies, contacts] = await Promise.all([
    db.pipeline.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: { stages: { where: { type: "OPEN" }, orderBy: { position: "asc" } } },
    }),
    db.company.findMany({ where: { organizationId, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.contact.findMany({ where: { organizationId, deletedAt: null }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], select: { id: true, firstName: true, lastName: true } }),
  ]);
  const defaultPipeline = pipelines[0];
  const defaultStage = defaultPipeline?.stages[0];

  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={[{ label: "Pipeline", href: "/pipeline" }, { label: "Nova oportunitat" }]}
        title="Crea una oportunitat"
        description="Afegeix valor, probabilitat i context per fer-ne el seguiment."
      />
      {error ? <div className="kanban-alert" role="alert">{error}</div> : null}
      <Card>
        <CardContent>
          <form action={createOpportunityAction}>
            <FormSection title="Oportunitat" description="Informació comercial principal.">
              <Field className="form-field--full" label="Títol" htmlFor="title" required><Input id="title" name="title" required autoFocus /></Field>
              <Field label="Empresa" htmlFor="companyId"><Select id="companyId" name="companyId" defaultValue={companyId || ""}><option value="">Sense empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</Select></Field>
              <Field label="Contacte" htmlFor="contactId"><Select id="contactId" name="contactId" defaultValue={contactId || ""}><option value="">Sense contacte</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{[contact.firstName, contact.lastName].filter(Boolean).join(" ")}</option>)}</Select></Field>
              <Field label="Valor" htmlFor="value" required><Input id="value" name="value" type="number" min="0" step="0.01" defaultValue="0" required /></Field>
              <Field label="Moneda" htmlFor="currency"><Input id="currency" name="currency" defaultValue="EUR" maxLength={3} /></Field>
              <Field label="Probabilitat (%)" htmlFor="probability"><Input id="probability" name="probability" type="number" min="0" max="100" defaultValue={defaultStage?.defaultProbability ?? 0} /></Field>
              <Field label="Data prevista de tancament" htmlFor="expectedCloseDate"><Input id="expectedCloseDate" name="expectedCloseDate" type="date" /></Field>
              <Field label="Origen" htmlFor="source"><Input id="source" name="source" /></Field>
            </FormSection>
            <FormSection title="Pipeline" description="Etapa inicial de l’oportunitat.">
              <Field label="Pipeline" htmlFor="pipelineId" required>
                <Select id="pipelineId" name="pipelineId" defaultValue={defaultPipeline?.id} required>
                  {pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
                </Select>
              </Field>
              <Field label="Etapa" htmlFor="stageId" required>
                <Select id="stageId" name="stageId" defaultValue={defaultStage?.id} required>
                  {pipelines.map((pipeline) => (
                    <optgroup key={pipeline.id} label={pipeline.name}>
                      {pipeline.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
                    </optgroup>
                  ))}
                </Select>
              </Field>
            </FormSection>
            <FormActions>
              <ButtonLink href="/pipeline" variant="ghost">Cancel·la</ButtonLink>
              <Button type="submit" disabled={!defaultPipeline}><BriefcaseBusiness size={17} /> Desa l’oportunitat</Button>
            </FormActions>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
