import { z } from "zod";

export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  CORS_ORIGINS: z.string().optional().default(""),

  PAYMENT_SANDBOX: z.coerce.boolean().default(true),
  AFIP_SANDBOX: z.coerce.boolean().default(true),
  INTEGRATIONS_MOCK: z.coerce.boolean().default(true),

  ANDREANI_LOGIN_URL: z.string().optional(),
  ANDREANI_COTIZADOR_URL: z.string().optional(),
  ANDREANI_PREENVIO_URL: z.string().optional(),
  ANDREANI_TRACKING_URL: z.string().optional(),

  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
  MERCADOPAGO_WEBHOOK_URL: z.string().optional(),
  MERCADOPAGO_SUCCESS_URL: z.string().optional(),
  MERCADOPAGO_FAILURE_URL: z.string().optional(),
  MERCADOPAGO_PENDING_URL: z.string().optional(),

  AFIP_CERT_PATH: z.string().optional(),
  AFIP_KEY_PATH: z.string().optional(),

  SUPERADMIN_TOKEN: z.string().optional(),
  BRANDING_SECRET: z.string().optional(),

  EMAIL_PROVIDER: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_FORCE_PATH_STYLE: z.coerce.boolean().optional(),
  STORAGE_PUBLIC_URL: z.string().optional(),
  STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().optional(),
  STORAGE_PUBLIC_FALLBACK_TTL_SECONDS: z.coerce.number().optional(),
  STORAGE_RETENTION_DAYS: z.coerce.number().optional(),

  LICENSE_SECRET: z.string().optional(),
  LICENSE_SERVER_URL: z.string().optional(),

  SUPPORT_API_URL: z.string().optional(),
  SUPPORT_ADMIN_URL: z.string().optional(),
  SUPPORT_STOREFRONT_URL: z.string().optional(),
  SUPPORT_BOT_URL: z.string().optional(),

  SECRETS_MASTER_KEY: z.string().optional(),

  ANDREANI_TEST_POSTAL: z.string().optional(),
  ANDREANI_TEST_CITY: z.string().optional(),
  ANDREANI_TEST_COUNTRY: z.string().optional(),
  ANDREANI_TEST_WEIGHT_KG: z.coerce.number().optional(),
  ANDREANI_TEST_CREATE: z.string().optional(),
  ANDREANI_TEST_TRACKING_CODE: z.string().optional(),
  ANDREANI_TEST_SENDER_NAME: z.string().optional(),
  ANDREANI_TEST_SENDER_ADDRESS: z.string().optional(),
  ANDREANI_TEST_SENDER_POSTAL: z.string().optional(),
  ANDREANI_TEST_SENDER_CITY: z.string().optional(),
  ANDREANI_TEST_SENDER_COUNTRY: z.string().optional(),
  ANDREANI_TEST_RECIPIENT_NAME: z.string().optional(),
  ANDREANI_TEST_RECIPIENT_ADDRESS: z.string().optional(),
  ANDREANI_TEST_RECIPIENT_POSTAL: z.string().optional(),
  ANDREANI_TEST_RECIPIENT_CITY: z.string().optional(),
  ANDREANI_TEST_RECIPIENT_COUNTRY: z.string().optional(),

  SUPPORT_PORTAL_JWT_SECRET: z.string().optional(),
  SUPPORT_EMAIL_INBOUND_ENABLED: z.string().optional(),
  SUPPORT_EMAIL_INBOUND_TOKEN: z.string().optional(),

  PLUGIN_SIGNING_SECRET: z.string().optional(),
  PLUGIN_ALLOWLIST: z.string().optional(),
  PLUGIN_ALLOW_UNSIGNED: z.string().optional(),

  CONTROL_PLANE_URL: z.string().optional(),
  CONTROL_PLANE_ALERT_WEBHOOK_URL: z.string().optional(),
  CONTROL_PLANE_ALERT_WEBHOOK_TOKEN: z.string().optional(),
  AGENT_SECRET: z.string().optional(),
  INSTANCE_ID: z.string().optional(),
  BOT_ALERT_WEBHOOK_URL: z.string().optional(),

  EVENT_INGEST_TOKEN: z.string().optional(),
  EVENT_SINK_URL: z.string().optional(),

  WAREHOUSE_PROVIDER: z.string().optional(),
  CLICKHOUSE_URL: z.string().optional(),
  CLICKHOUSE_DB: z.string().optional(),
  CLICKHOUSE_USER: z.string().optional(),
  CLICKHOUSE_PASSWORD: z.string().optional(),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export function validateEnv(env: Record<string, any>) {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`);
  }
  return result.data;
}
