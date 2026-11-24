import { crmExportTypes, buildCrmCsvExport, type CrmExportType } from "@/modules/exports/crm-csv";
import { requireTenant } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!crmExportTypes.includes(type as CrmExportType)) {
    return new Response("Exportació no disponible", { status: 404 });
  }

  const context = await requireTenant();
  const csv = await buildCrmCsvExport(context, type as CrmExportType);
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="aimetos-${type}-${date}.csv"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
