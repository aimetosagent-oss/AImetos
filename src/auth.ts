import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { authorizeCredentials } from "@/lib/authentication";
import { env } from "@/lib/env";
import { publicRequestIdentity } from "@/lib/request-identity";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: process.env.AUTH_TRUST_HOST === "true",
  secret: process.env.AUTH_SECRET,
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [
    Credentials({
      name: "Correu i contrasenya",
      credentials: {
        email: { label: "Correu electrònic", type: "email" },
        password: { label: "Contrasenya", type: "password" },
      },
      authorize: (credentials, request) =>
        authorizeCredentials(
          credentials,
          publicRequestIdentity(request.headers, env().AUTH_TRUSTED_PROXY_HOPS).rateLimitKey,
        ),
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.organizationId = user.organizationId;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      const organizationId = typeof token.organizationId === "string" ? token.organizationId : null;
      const role = token.role === "ADMIN" || token.role === "MEMBER" ? token.role : null;
      if (session.user && token.sub && organizationId && role) {
        session.user.id = token.sub;
        session.user.organizationId = organizationId;
        session.user.role = role;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.organizationId) return;
      await db.auditLog.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          action: "AUTH_LOGIN",
          entityType: "User",
          entityId: user.id,
          metadata: { email: user.email },
        },
      });
    },
  },
});
