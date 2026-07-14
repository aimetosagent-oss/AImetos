import { FileInput } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormActions } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

import { createFormAction } from "../../actions";
import { FormEditor } from "../form-editor";

export default async function NewFormPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { organizationId } = await requireTenant();
  const { error } = await searchParams;
  const pipelines = await db.pipeline.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: { stages: { where: { type: "OPEN" }, orderBy: { position: "asc" }, select: { id: true, name: true } } },
  });
  return (
    <div className="page-stack">
      <PageHeader breadcrumbs={[{ label: "Formularis", href: "/forms" }, { label: "Nou formulari" }]} title="Crea un formulari" description="Defineix els camps, la destinació comercial i el comportament posterior a l’enviament." />
      {error ? <div className="kanban-alert" role="alert">{error}</div> : null}
      <Card>
        <CardContent>
          <form action={createFormAction}>
            <FormEditor pipelines={pipelines} />
            <FormActions><ButtonLink href="/forms" variant="ghost">Cancel·la</ButtonLink><Button type="submit" disabled={!pipelines.length}><FileInput size={17} /> Desa el formulari</Button></FormActions>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
