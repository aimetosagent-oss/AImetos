import { notFound } from "next/navigation";
import { Save } from "lucide-react";
import { Button, ButtonLink, Card, CardContent, Field, FormActions, FormGrid, Input, PageHeader, Select, Textarea } from "@/components";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { updateCommercialRecordAction } from "../../../actions";

export default async function EditRecordPage({ params, searchParams }: {
  params: Promise<{ type: string; id: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { organizationId } = await requireTenant();
  const { type, id } = await params;
  const { error } = await searchParams;
  const where = { id, organizationId, deletedAt: null };
  const record = type === "companies" ? await db.company.findFirst({ where })
    : type === "contacts" ? await db.contact.findFirst({ where })
    : type === "opportunities" ? await db.opportunity.findFirst({ where }) : null;
  if (!record) notFound();
  const data = record as unknown as Record<string, unknown>;
  const companies = type !== "companies" ? await db.company.findMany({ where: { organizationId, deletedAt: null }, orderBy: { name: "asc" } }) : [];
  const contacts = type === "opportunities" ? await db.contact.findMany({ where: { organizationId, deletedAt: null }, orderBy: { firstName: "asc" } }) : [];
  const members = type === "opportunities" ? await db.membership.findMany({ where: { organizationId, isActive: true, user: { isActive: true } }, include: { user: true } }) : [];
  const fields = type === "companies"
    ? [["name", "Nom comercial"], ["legalName", "Raó social"], ["taxId", "NIF"], ["sector", "Sector"], ["email", "Correu electrònic", "email"], ["phone", "Telèfon"], ["website", "Web", "url"], ["address", "Adreça"], ["city", "Ciutat"], ["postalCode", "Codi postal"], ["country", "País"], ["source", "Origen"]]
    : type === "contacts"
      ? [["firstName", "Nom"], ["lastName", "Cognoms"], ["email", "Correu electrònic", "email"], ["phone", "Telèfon"], ["position", "Càrrec"], ["preferredLanguage", "Idioma preferit"], ["source", "Origen"]]
      : [["title", "Títol"], ["value", "Valor", "number"], ["recurringAmount", "Import recurrent", "number"], ["serviceStartDate", "Data prevista d'inici", "date"], ["currency", "Moneda"], ["probability", "Probabilitat (%)", "number"], ["expectedCloseDate", "Data prevista de tancament", "date"], ["source", "Origen"]];
  const back = type === "opportunities" ? `/pipeline/${id}` : `/${type}/${id}`;
  return <div className="page-stack">
    <PageHeader title="Edita el registre" />
    {error ? <p role="alert" className="kanban-alert">{error}</p> : null}
    <Card><CardContent><form action={updateCommercialRecordAction}>
      <input type="hidden" name="type" value={type} /><input type="hidden" name="id" value={id} />
      <FormGrid>{fields.map(([name, label, inputType]) => {
        const value = name === "value" ? Number(data.valueCents) / 100 : name === "recurringAmount" ? Number(data.recurringAmountCents) / 100 : data[name];
        return <Field key={name} label={label} htmlFor={name}><Input id={name} name={name} type={inputType || "text"} step={inputType === "number" ? "0.01" : undefined} defaultValue={value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "")} /></Field>;
      })}
      {type !== "companies" ? <Field label="Empresa" htmlFor="companyId"><Select id="companyId" name="companyId" defaultValue={String(data.companyId ?? "")}><option value="">Sense empresa</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field> : null}
      {type === "opportunities" ? <>
        <Field label="Periodicitat" htmlFor="recurringInterval"><Select id="recurringInterval" name="recurringInterval" defaultValue={String(data.recurringInterval ?? "")}><option value="">Sense recurrència</option><option value="MONTHLY">Mensual</option><option value="QUARTERLY">Trimestral</option><option value="YEARLY">Anual</option></Select></Field>
        <Field label="Contacte" htmlFor="contactId"><Select id="contactId" name="contactId" defaultValue={String(data.contactId ?? "")}><option value="">Sense contacte</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} · {c.email}</option>)}</Select></Field>
        <Field label="Responsable" htmlFor="ownerId"><Select id="ownerId" name="ownerId" defaultValue={String(data.ownerId ?? "")}>{members.map(m => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}</Select></Field>
      </> : <Field label="Notes" htmlFor="notesText"><Textarea id="notesText" name="notesText" rows={5} defaultValue={String(data.notesText ?? "")} /></Field>}
      </FormGrid>
      <FormActions><ButtonLink href={back} variant="ghost">Cancel·la</ButtonLink><Button type="submit"><Save size={17} /> Desa els canvis</Button></FormActions>
    </form></CardContent></Card>
  </div>;
}
