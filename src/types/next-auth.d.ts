import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    organizationId: string;
    role: "ADMIN" | "MEMBER";
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      organizationId: string;
      role: "ADMIN" | "MEMBER";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    organizationId?: string;
    role?: "ADMIN" | "MEMBER";
  }
}
