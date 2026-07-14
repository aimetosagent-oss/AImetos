export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    "/((?!api/auth|api/health|api/public|api/webhooks/stripe|login|f/|q/|i/|_next/static|_next/image|favicon.ico|brand/).*)",
  ],
};
