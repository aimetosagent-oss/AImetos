import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { CrmShell } from "@/components/crm-shell";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

import { logoutAction } from "./actions";

export default async function ProtectedCrmLayout({ children }: { children: ReactNode }) {
  const context = await requireTenant();
  const [organization, user, pendingTasks] = await Promise.all([
    db.organization.findFirst({
      where: { id: context.organizationId, deletedAt: null },
      select: { name: true },
    }),
    db.user.findFirst({
      where: { id: context.userId, isActive: true },
      select: { name: true, email: true },
    }),
    db.task.count({
      where: {
        organizationId: context.organizationId,
        deletedAt: null,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    }),
  ]);

  if (!organization || !user) notFound();

  return (
    <CrmShell
      organization={organization}
      user={user}
      pendingTasks={pendingTasks}
      signOutAction={logoutAction}
    >
      {children}
    </CrmShell>
  );
}
