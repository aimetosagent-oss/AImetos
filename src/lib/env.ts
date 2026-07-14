import { z } from "zod";

const optionalString = z.preprocess((value) => (value === "" ? undefined : value), z.string().optional());
const booleanString = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off", ""].includes(normalized)) return false;
  return value;
}, z.boolean());

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  APP_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_EMAIL: z.email().default("admin@aimetos.local"),
  ADMIN_PASSWORD: z.string().min(12).default("AdminAimetos2026!"),
  ADMIN_NAME: z.string().default("Administrador AImetos"),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: booleanString.default(false),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_FROM_NAME: z.string().default("AImetos"),
  SMTP_FROM_EMAIL: z.email().default("crm@aimetos.local"),
  STRIPE_SECRET_KEY: optionalString,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  WORKER_ID: z.string().default("worker-local"),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(250).default(2000),
  WORKER_LOCK_TIMEOUT_MINUTES: z.coerce.number().int().min(1).default(10),
  INTEGRATION_ENCRYPTION_KEY: optionalString,
  PUBLIC_FORM_TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  AUTH_TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
});

export type AppEnv = z.infer<typeof schema>;

export type StripeTestConfiguration = Pick<
  AppEnv,
  "STRIPE_SECRET_KEY" | "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" | "STRIPE_WEBHOOK_SECRET"
>;

let cached: AppEnv | undefined;

export function env(): AppEnv {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

export function stripeTestConfigurationIsComplete(configuration: StripeTestConfiguration) {
  return Boolean(
    configuration.STRIPE_SECRET_KEY?.trim().startsWith("sk_test_") &&
      configuration.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim().startsWith("pk_test_") &&
      configuration.STRIPE_WEBHOOK_SECRET?.trim().startsWith("whsec_"),
  );
}

export function stripeIsConfigured() {
  return stripeTestConfigurationIsComplete(env());
}
