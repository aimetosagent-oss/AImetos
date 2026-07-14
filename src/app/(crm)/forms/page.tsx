import Link from "next/link";
import { ExternalLink, FileInput, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

import { toggleFormAction } from "../actions";

export default async function FormsPage() {
  const { organizationId } = await requireTenant();
  const forms = await db.form.findMany({
    where: { organizationId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      pipeline: { select: { name: true } },
      initialStage: { select: { name: true } },
      _count: { select: { submissions: true, fields: true } },
    },
  });
  const columns: DataTableColumn<(typeof forms)[number]>[] = [
    {
      key: "name",
      header: "Formulari",
      render: (form) => <div><Link className="table-primary link-inline" href={`/forms/${form.id}`}>{form.name}</Link><span className="table-secondary">/f/{form.slug}</span></div>,
    },
    { key: "status", header: "Estat", render: (form) => <Badge tone={form.isActive ? "success" : "neutral"} dot>{form.isActive ? "Actiu" : "Inactiu"}</Badge> },
    { key: "pipeline", header: "Destinació", render: (form) => <div>{form.pipeline.name}<span className="table-secondary">{form.initialStage.name}</span></div> },
    { key: "fields", header: "Camps", align: "right", render: (form) => form._count.fields },
    { key: "submissions", header: "Enviaments", align: "right", render: (form) => form._count.submissions },
    {
      key: "actions",
      header: "Accions",
      align: "right",
      render: (form) => (
        <div className="toolbar__actions" style={{ justifyContent: "flex-end" }}>
          <a className="ui-button ui-button--ghost ui-button--sm" href={`/f/${form.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Obre</a>
          <form action={toggleFormAction}><input type="hidden" name="formId" value={form.id} /><Button size="sm" variant="outline" type="submit">{form.isActive ? "Desactiva" : "Activa"}</Button></form>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Captació"
        title="Formularis"
        description="Formularis públics que creen contactes, empreses i oportunitats automàticament."
        actions={<ButtonLink href="/forms/new"><Plus size={17} /> Crea formulari</ButtonLink>}
      />
      {forms.length ? <DataTable caption="Llista de formularis" columns={columns} rows={forms} getRowKey={(form) => form.id} /> : <div className="ui-card"><EmptyState icon={FileInput} title="Encara no hi ha formularis" description="Crea un formulari configurable i comparteix-lo o incrusta’l al web." action={<ButtonLink href="/forms/new">Crea formulari</ButtonLink>} /></div>}
    </div>
  );
}
