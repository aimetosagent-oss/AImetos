import { db } from "@/lib/db";

export type ActiveTenantContext = {
  organizationId: string;
  userId: string;
  role: "ADMIN" | "MEMBER";
};

export async function getActiveTenantContext(
  userId: string,
  organizationId: string,
): Promise<ActiveTenantContext | null> {
  const membership = await db.membership.findFirst({
    where: {
      userId,
      organizationId,
      isActive: true,
      user: { isActive: true },
      organization: { deletedAt: null },
    },
    select: { role: true },
  });

  return membership ? { organizationId, userId, role: membership.role } : null;
}
