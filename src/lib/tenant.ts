import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ForbiddenError } from "@/lib/errors";
import { getActiveTenantContext, type ActiveTenantContext } from "@/lib/tenant-state";

export type TenantContext = ActiveTenantContext;

export async function requireTenant(): Promise<TenantContext> {
  const session = await auth();
  if (!session?.user?.id || !session.user.organizationId) redirect("/login");
  const context = await getActiveTenantContext(session.user.id, session.user.organizationId);
  if (!context) redirect("/login");
  return context;
}

export async function requireAdmin() {
  const context = await requireTenant();
  if (context.role !== "ADMIN") throw new ForbiddenError();
  return context;
}
