import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

process.env.AUTH_SECRET ??= "test-secret-that-is-at-least-thirty-two-characters";
process.env.APP_URL ??= "http://127.0.0.1:3000";
process.env.ADMIN_EMAIL ??= "admin@aimetos.local";
process.env.ADMIN_PASSWORD ??= "AdminAimetos2026!";
process.env.SMTP_FROM_EMAIL ??= "crm@aimetos.local";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:51214/template1?sslmode=disable&pgbouncer=true&connection_limit=1&connect_timeout=0&max_idle_connection_lifetime=0&pool_timeout=0&socket_timeout=0";
