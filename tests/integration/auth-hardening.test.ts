import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authorizeCredentials } from "@/lib/authentication";
import { db } from "@/lib/db";
import { getActiveTenantContext } from "@/lib/tenant-state";
import { createTestFixture, removeFixture } from "./helpers";

describe("immediate authentication and tenant revocation", () => {
  let fixture: Awaited<ReturnType<typeof createTestFixture>>;

  beforeAll(async () => {
    fixture = await createTestFixture("auth-hardening");
  });

  afterAll(async () => removeFixture(fixture.organization.id, fixture.user.id));

  it("authorizes only an active user, membership and organization", async () => {
    await expect(
      authorizeCredentials({ email: fixture.user.email.toUpperCase(), password: "TestPassword123!" }),
    ).resolves.toMatchObject({ id: fixture.user.id, organizationId: fixture.organization.id, role: "ADMIN" });

    await db.membership.update({
      where: { organizationId_userId: { organizationId: fixture.organization.id, userId: fixture.user.id } },
      data: { isActive: false },
    });
    await expect(authorizeCredentials({ email: fixture.user.email, password: "TestPassword123!" })).resolves.toBeNull();

    await db.membership.update({
      where: { organizationId_userId: { organizationId: fixture.organization.id, userId: fixture.user.id } },
      data: { isActive: true },
    });
    await db.organization.update({ where: { id: fixture.organization.id }, data: { deletedAt: new Date() } });
    await expect(authorizeCredentials({ email: fixture.user.email, password: "TestPassword123!" })).resolves.toBeNull();

    await db.organization.update({ where: { id: fixture.organization.id }, data: { deletedAt: null } });
    await db.user.update({ where: { id: fixture.user.id }, data: { isActive: false } });
    await expect(authorizeCredentials({ email: fixture.user.email, password: "TestPassword123!" })).resolves.toBeNull();
    await db.user.update({ where: { id: fixture.user.id }, data: { isActive: true } });
  });

  it("revalidates membership and returns the live role on every request", async () => {
    await expect(getActiveTenantContext(fixture.user.id, fixture.organization.id)).resolves.toMatchObject({ role: "ADMIN" });

    await db.membership.update({
      where: { organizationId_userId: { organizationId: fixture.organization.id, userId: fixture.user.id } },
      data: { role: "MEMBER" },
    });
    await expect(getActiveTenantContext(fixture.user.id, fixture.organization.id)).resolves.toMatchObject({ role: "MEMBER" });

    await db.membership.update({
      where: { organizationId_userId: { organizationId: fixture.organization.id, userId: fixture.user.id } },
      data: { isActive: false },
    });
    await expect(getActiveTenantContext(fixture.user.id, fixture.organization.id)).resolves.toBeNull();
  });

  it("limits repeated password attempts per account and request source", async () => {
    await db.membership.update({
      where: { organizationId_userId: { organizationId: fixture.organization.id, userId: fixture.user.id } },
      data: { isActive: true, role: "ADMIN" },
    });
    const identity = "ip:203.0.113.42";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(
        authorizeCredentials({ email: fixture.user.email, password: "incorrecta" }, identity),
      ).resolves.toBeNull();
    }

    await expect(
      authorizeCredentials({ email: fixture.user.email, password: "TestPassword123!" }, identity),
    ).resolves.toBeNull();

    await expect(
      authorizeCredentials({ email: fixture.user.email, password: "TestPassword123!" }, "ip:203.0.113.43"),
    ).resolves.toMatchObject({ id: fixture.user.id, organizationId: fixture.organization.id });
  });
});
