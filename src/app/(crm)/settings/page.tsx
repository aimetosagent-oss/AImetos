import { KeyRound, Plus, Settings2, Webhook } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckboxField, Field, FormActions, FormSection, Input } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { stripeIsConfigured } from "@/lib/env";
import { requireTenant } from "@/lib/tenant";

import { createWebhookEndpointAction, toggleWebhookEndpointAction, updateOrganizationSettingsAction } from "../actions";

const webhookEvents = [
  "form.submitted", "contact.created", "contact.updated", "opportunity.created", "opportunity.stage_changed", "quote.created", "quote.sent", "quote.viewed", "quote.accepted", "quote.rejected", "quote.expired", "quote.followup_due", "invoice.created", "invoice.sent", "invoice.paid", "invoice.overdue", "invoice.reminder_due", "task.created", "task.due",
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; updated?: string; created?: string; section?: string }>;
}) {
  const context = await requireTenant();
  const state = await searchParams;
  const [organization, existingSettings, endpoints] = await Promise.all([
    db.organization.findFirst({ where: { id: context.organizationId, deletedAt: null }, select: { name: true } }),
    db.organizationSettings.findUnique({ where: { organizationId: context.organizationId } }),
    db.webhookEndpoint.findMany({ where: { organizationId: context.organizationId, archivedAt: null }, orderBy: { createdAt: "desc" }, include: { _count: { select: { deliveries: true } } } }),
  ]);
  const settings = existingSettings ?? {
    tradeName: organization?.name ?? "AImetos", legalName: null, taxId: null, email: null, phone: null, website: null, address: null, city: null, postalCode: null, country: "ES", currency: "EUR", defaultTaxRateBps: 2100, paymentTermsDays: 30, timezone: "Europe/Madrid", quotePrefix: "P", quoteNumberLength: 4, quoteValidityDays: 30, quoteFollowUpDays: [3, 7, 14], invoicePrefix: "F", invoiceNumberLength: 4, invoiceDueDays: 30, invoiceReminderOffsetsDays: [-3, 0, 3, 7], stripeEnabled: false, stripeTestMode: true, onboardingTaskOnPayment: true,
  };
  const isAdmin = context.role === "ADMIN";
  const encryptionReady = Boolean(
    process.env.INTEGRATION_ENCRYPTION_KEY &&
      Buffer.from(process.env.INTEGRATION_ENCRYPTION_KEY, "base64").length === 32,
  );
  const stripeReady = stripeIsConfigured();
  const smtpReady = Boolean(process.env.SMTP_HOST);

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Administració" title="Configuració" description="Dades corporatives, numeració documental i integracions opcionals." />
      {state.error ? <div className="kanban-alert" role="alert">{state.error}</div> : null}
      {state.updated || state.created ? <div className="ui-badge ui-badge--success">Canvis desats correctament.</div> : null}
      {!isAdmin ? <div className="kanban-alert" role="status">Només els administradors poden modificar aquesta configuració.</div> : null}

      <Card>
        <CardContent>
          <form action={updateOrganizationSettingsAction}>
            <FormSection title="Empresa" description="Dades que apareixeran als documents comercials.">
              <Field label="Nom comercial" htmlFor="tradeName" required><Input id="tradeName" name="tradeName" defaultValue={settings.tradeName} required /></Field>
              <Field label="Raó social" htmlFor="legalName"><Input id="legalName" name="legalName" defaultValue={settings.legalName ?? ""} /></Field>
              <Field label="NIF" htmlFor="taxId"><Input id="taxId" name="taxId" defaultValue={settings.taxId ?? ""} /></Field>
              <Field label="Correu" htmlFor="email"><Input id="email" name="email" type="email" defaultValue={settings.email ?? ""} /></Field>
              <Field label="Telèfon" htmlFor="phone"><Input id="phone" name="phone" defaultValue={settings.phone ?? ""} /></Field>
              <Field label="Web" htmlFor="website"><Input id="website" name="website" type="url" defaultValue={settings.website ?? ""} /></Field>
              <Field className="form-field--full" label="Adreça" htmlFor="address"><Input id="address" name="address" defaultValue={settings.address ?? ""} /></Field>
              <Field label="Ciutat" htmlFor="city"><Input id="city" name="city" defaultValue={settings.city ?? ""} /></Field>
              <Field label="Codi postal" htmlFor="postalCode"><Input id="postalCode" name="postalCode" defaultValue={settings.postalCode ?? ""} /></Field>
              <Field label="País" htmlFor="country"><Input id="country" name="country" defaultValue={settings.country} maxLength={2} /></Field>
              <Field label="Moneda" htmlFor="currency"><Input id="currency" name="currency" defaultValue={settings.currency} maxLength={3} /></Field>
              <Field label="IVA per defecte (%)" htmlFor="defaultTaxRate"><Input id="defaultTaxRate" name="defaultTaxRate" type="number" min="0" max="100" step="0.01" defaultValue={settings.defaultTaxRateBps / 100} /></Field>
              <Field label="Condicions de pagament (dies)" htmlFor="paymentTermsDays"><Input id="paymentTermsDays" name="paymentTermsDays" type="number" min="0" defaultValue={settings.paymentTermsDays} /></Field>
              <Field label="Zona horària" htmlFor="timezone"><Input id="timezone" name="timezone" defaultValue={settings.timezone} /></Field>
            </FormSection>
            <FormSection title="Pressupostos" description="Numeració i seguiments per defecte.">
              <Field label="Prefix" htmlFor="quotePrefix"><Input id="quotePrefix" name="quotePrefix" defaultValue={settings.quotePrefix} /></Field>
              <Field label="Longitud" htmlFor="quoteNumberLength"><Input id="quoteNumberLength" name="quoteNumberLength" type="number" min="2" max="10" defaultValue={settings.quoteNumberLength} /></Field>
              <Field label="Validesa (dies)" htmlFor="quoteValidityDays"><Input id="quoteValidityDays" name="quoteValidityDays" type="number" min="1" defaultValue={settings.quoteValidityDays} /></Field>
              <Field label="Seguiments (dies)" htmlFor="quoteFollowUpDays" hint="Dies separats per comes."><Input id="quoteFollowUpDays" name="quoteFollowUpDays" defaultValue={settings.quoteFollowUpDays.join(", ")} /></Field>
            </FormSection>
            <FormSection title="Factures" description="Numeració, venciment i recordatoris.">
              <Field label="Prefix" htmlFor="invoicePrefix"><Input id="invoicePrefix" name="invoicePrefix" defaultValue={settings.invoicePrefix} /></Field>
              <Field label="Longitud" htmlFor="invoiceNumberLength"><Input id="invoiceNumberLength" name="invoiceNumberLength" type="number" min="2" max="10" defaultValue={settings.invoiceNumberLength} /></Field>
              <Field label="Venciment (dies)" htmlFor="invoiceDueDays"><Input id="invoiceDueDays" name="invoiceDueDays" type="number" min="0" defaultValue={settings.invoiceDueDays} /></Field>
              <Field label="Recordatoris" htmlFor="invoiceReminderOffsetsDays" hint="Valors negatius abans del venciment; separats per comes."><Input id="invoiceReminderOffsetsDays" name="invoiceReminderOffsetsDays" defaultValue={settings.invoiceReminderOffsetsDays.join(", ")} /></Field>
              <CheckboxField name="onboardingTaskOnPayment" label="Crea una tasca d’onboarding quan es cobra" defaultChecked={settings.onboardingTaskOnPayment} />
            </FormSection>
            <FormSection title="Stripe" description="Checkout opcional. Aquest MVP bloqueja sempre les claus i els cobraments live.">
              <CheckboxField name="stripeEnabled" label="Activa els pagaments Stripe" defaultChecked={settings.stripeEnabled} />
              <CheckboxField name="stripeTestMode" label="Mode test" defaultChecked={settings.stripeTestMode} />
            </FormSection>
            {isAdmin ? <FormActions><Button type="submit"><Settings2 size={17} /> Desa la configuració</Button></FormActions> : null}
          </form>
        </CardContent>
      </Card>

      <section className="metrics-grid" aria-label="Estat de les integracions">
        <div className="metric-card"><div className="metric-card__icon metric-card__icon--blue"><KeyRound size={20} /></div><div className="metric-card__body"><span className="metric-card__label">Stripe test</span><strong className="metric-card__value" style={{ fontSize: "1rem" }}>{stripeReady ? "Configurat" : "No configurat"}</strong><span className="metric-card__detail">Les claus mai no es mostren.</span></div></div>
        <div className="metric-card"><div className="metric-card__icon metric-card__icon--petrol"><KeyRound size={20} /></div><div className="metric-card__body"><span className="metric-card__label">SMTP</span><strong className="metric-card__value" style={{ fontSize: "1rem" }}>{smtpReady ? "Configurat" : "Mailpit local"}</strong><span className="metric-card__detail">Enviament opcional i reintentable.</span></div></div>
        <div className="metric-card"><div className="metric-card__icon metric-card__icon--success"><Webhook size={20} /></div><div className="metric-card__body"><span className="metric-card__label">Webhooks</span><strong className="metric-card__value" style={{ fontSize: "1rem" }}>{endpoints.length} endpoints</strong><span className="metric-card__detail">{encryptionReady ? "Xifrat disponible" : "Falta la clau de xifrat"}</span></div></div>
      </section>

      <Card>
        <CardHeader><div><CardTitle>Webhooks sortints</CardTitle><p className="ui-card__description">Les entregues no bloquegen les accions del CRM.</p></div><Badge tone={encryptionReady ? "success" : "warning"}>{encryptionReady ? "Xifrat actiu" : "No disponible"}</Badge></CardHeader>
        <CardContent>
          {endpoints.map((endpoint) => (
            <div key={endpoint.id} className="ui-card__footer webhook-endpoint-row">
              <div className="webhook-endpoint-copy"><strong>{endpoint.name}</strong><span className="table-secondary">{endpoint.url} · secret ••••{endpoint.secretHint || ""} · {endpoint._count.deliveries} entregues</span></div>
              <Badge tone={endpoint.isActive ? "success" : "neutral"}>{endpoint.isActive ? "Actiu" : "Inactiu"}</Badge>
              {isAdmin ? <form action={toggleWebhookEndpointAction}><input type="hidden" name="endpointId" value={endpoint.id} /><Button size="sm" variant="outline" type="submit">{endpoint.isActive ? "Desactiva" : "Activa"}</Button></form> : null}
            </div>
          ))}
          {isAdmin && encryptionReady ? (
            <form action={createWebhookEndpointAction} style={{ marginTop: 24 }}>
              <div className="form-grid">
                <Field label="Nom" htmlFor="webhook-name" required><Input id="webhook-name" name="name" required /></Field>
                <Field label="URL" htmlFor="webhook-url" required><Input id="webhook-url" name="url" type="url" placeholder="https://n8n.exemple.cat/webhook/…" required /></Field>
                <Field className="form-field--full" label="Secret HMAC" htmlFor="webhook-secret" hint="Mínim 16 caràcters. No es tornarà a mostrar."><Input id="webhook-secret" name="secret" type="password" minLength={16} required /></Field>
                <div className="form-field--full"><span className="form-label">Esdeveniments</span><div className="form-grid">{webhookEvents.map((event) => <CheckboxField key={event} name="eventTypes" value={event} label={event} defaultChecked={event === "form.submitted" || event === "invoice.paid"} />)}</div></div>
              </div>
              <FormActions><Button type="submit"><Plus size={17} /> Crea endpoint</Button></FormActions>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
