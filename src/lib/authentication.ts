import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/normalization";
import { hashIdentifier } from "@/lib/tokens";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ACCOUNT_LIMIT = 20;
const LOGIN_SOURCE_LIMIT = 10;
const DUMMY_PASSWORD_HASH = "$2b$12$p2hdxPKeU2GpVgRfoR4mUeT2pqj3GwBqXk8KkRgAKTBoqRydwZ5Ci";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
});

export async function authorizeCredentials(raw: unknown, requestIdentity = "direct") {
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) return null;
  const email = normalizeEmail(parsed.data.email);
  if (!email) return null;

  const user = await db.user.findFirst({
    where: { email, isActive: true },
    include: {
      memberships: {
        where: { isActive: true, organization: { deletedAt: null } },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
  const membership = user?.memberships[0];
  if (!user || !membership) {
    await compare(parsed.data.password, DUMMY_PASSWORD_HASH);
    return null;
  }

  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / LOGIN_WINDOW_MS) * LOGIN_WINDOW_MS);
  const expiresAt = new Date(windowStart.getTime() + LOGIN_WINDOW_MS);
  const accountKeyHash = hashIdentifier(email);
  const sourceKeyHash = hashIdentifier(requestIdentity);
  const [accountCounter, sourceCounter] = await db.$transaction([
    db.rateLimitCounter.upsert({
      where: {
        organizationId_namespace_keyHash_windowStart: {
          organizationId: membership.organizationId,
          namespace: "auth-login-account",
          keyHash: accountKeyHash,
          windowStart,
        },
      },
      create: {
        organizationId: membership.organizationId,
        namespace: "auth-login-account",
        keyHash: accountKeyHash,
        windowStart,
        windowSeconds: LOGIN_WINDOW_MS / 1000,
        expiresAt,
      },
      update: { count: { increment: 1 } },
    }),
    db.rateLimitCounter.upsert({
      where: {
        organizationId_namespace_keyHash_windowStart: {
          organizationId: membership.organizationId,
          namespace: "auth-login-source",
          keyHash: sourceKeyHash,
          windowStart,
        },
      },
      create: {
        organizationId: membership.organizationId,
        namespace: "auth-login-source",
        keyHash: sourceKeyHash,
        windowStart,
        windowSeconds: LOGIN_WINDOW_MS / 1000,
        expiresAt,
      },
      update: { count: { increment: 1 } },
    }),
  ]);
  if (accountCounter.count > LOGIN_ACCOUNT_LIMIT || sourceCounter.count > LOGIN_SOURCE_LIMIT) return null;

  if (!(await compare(parsed.data.password, user.passwordHash))) return null;

  await db.rateLimitCounter.deleteMany({
    where: {
      organizationId: membership.organizationId,
      OR: [
        { namespace: "auth-login-account", keyHash: accountKeyHash },
        { namespace: "auth-login-source", keyHash: sourceKeyHash },
      ],
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: membership.organizationId,
    role: membership.role,
  };
}
