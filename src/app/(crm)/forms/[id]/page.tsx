import { ExternalLink, Save } from "lucide-react";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { FormActions } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

import { updateFormAction } from "../../actions";
import { FormEditor } from "../form-editor";

const dateFormatter = new Intl.DateTimeFormat("ca-ES", { dateStyle: "medium", timeStyle: "short" });

export default async function FormDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; created?: string; updated?: string }>;
}) {
  const { organizationId } = await requireTenant();
  const { id } = await params;
  const state = await searchParams;
  const [form, pipelines] = await Promise.all([
    db.form.findFirst({
      where: { id, organizationId, archivedAt: null },
      include: {
        fields: { orderBy: { position: "asc" } },
        submissions: { orderBy: { submittedAt: "desc" }, take: 20, include: { contact: { select: { id: true, firstName: true, lastName: true, email: true } }, company: { select: { id: true, name: true } } } },
      },
    }),
    db.pipeline.findMany({ where: { organizationId, isActive: true }, orderBy: [{ isDefault: "desc" }, { name: "asc" }], include: { stages: { where: { type: "OPEN" }, orderBy: { position: "asc" }, select: { id: true, name: true } } } }),
  ]);
  if (!form) notFound();
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const publicUrl = `${appUrl}/f/${form.slug}`;
  const iframe = `<iframe src="${publicUrl}" width="100%" height="720" frameborder="0" title="${form.name}"></iframe>`;
  const submissionColumns: DataTableColumn<(typeof form.submissions)[number]>[] = [
    { key: "date", header: "Data", render: (submission) => dateFormatter.format(submission.submittedAt) },
    { key: "contact", header: "Contacte", render: (submission) => submission.contact ? <a className="link-inline" href={`/contacts/${submission.contact.id}`}>{[submission.contact.firstName, submission.contact.lastName].filter(Boolean).join(" ") || submission.contact.email}</a> : "—" },
    { key: "company", header: "Empresa", render: (submission) => submission.company ? <a className="link-inline" href={`/companies/${submission.company.id}`}>{submission.company.name}</a> : "—" },
    { key: "spam", header: "Qualitat", render: (submission) => <Badge tone={submission.isSpam ? "danger" : "success"}>{submission.isSpam ? "Spam" : "Vàlid"}</Badge> },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={[{ label: "Formularis", href: "/forms" }, { label: form.name }]}
        title={form.name}
        description={`URL pública: /f/${form.slug}`}
        actions={<a className="ui-button ui-button--outline ui-button--md" href={`/f/${form.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Previsualitza</a>}
      />
      {state.error ? <div className="kanban-alert" role="alert">{state.error}</div> : null}
      {state.created || state.updated ? <div className="ui-badge ui-badge--success">Canvis desats correctament.</div> : null}
      <Card>
        <CardHeader><CardTitle>Compartir i incrustar</CardTitle></CardHeader>
        <CardContent><p><strong>Enllaç:</strong> <a className="link-inline" href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a></p><p><strong>iframe:</strong></p><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}><code>{iframe}</code></pre></CardContent>
      </Card>
      <Card>
        <CardContent>
          <form action={updateFormAction}>
            <input type="hidden" name="formId" value={form.id} />
            <FormEditor pipelines={pipelines} form={form} />
            <FormActions><ButtonLink href="/forms" variant="ghost">Torna</ButtonLink><Button type="submit"><Save size={17} /> Desa els canvis</Button></FormActions>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Últims enviaments</CardTitle><Badge tone="blue">{form.submissions.length}</Badge></CardHeader>
        <CardContent><DataTable caption="Últims enviaments" columns={submissionColumns} rows={form.submissions} getRowKey={(submission) => submission.id} /></CardContent>
      </Card>
    </div>
  );
}
