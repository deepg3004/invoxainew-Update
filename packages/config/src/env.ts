import { z } from "zod";
import { loadEnv } from "./loadEnv";

/**
 * Server-side environment schema. This includes secrets (service-role key,
 * direct DB URL) and MUST only ever be read from server code. Importing this
 * into a client bundle would be a security bug — the @invoxai/auth client
 * helper deliberately reads only NEXT_PUBLIC_* values instead.
 */
const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Postgres (Supabase) — pooled for runtime, direct for migrations.
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  // Supabase. URL + anon key are public; service-role key is a server secret.
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Redis (same VPS).
  REDIS_URL: z.string().min(1),

  // Anthropic — only required from C9 onward, so optional for now.
  ANTHROPIC_API_KEY: z.string().optional().default(""),

  // Platform admin allowlist (C3) — comma-separated emails that may access the
  // admin app. Bootstraps admin identity without a chicken-and-egg DB seed;
  // the allowlist is matched case-insensitively against the verified session
  // email. Empty in non-admin deployments. SERVER ONLY.
  ADMIN_EMAILS: z.string().optional().default(""),

  // Platform Razorpay gateway (C4) — InvoxAI's OWN account, used only to collect
  // InvoxAI's subscription/AI-page fees from sellers (NOT buyer→seller money).
  // KEY_ID is also exposed to the browser via NEXT_PUBLIC_* for Checkout; the
  // SECRET and WEBHOOK_SECRET are SERVER ONLY. Optional until C4 goes live so
  // earlier deploys don't fail validation.
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(""),

  // GST tax-invoice details (Phase 1.3) for InvoxAI's own income. Fill with your
  // CA-confirmed legal entity + GSTIN; until GSTIN is set, invoices render as a
  // non-tax DRAFT. GST_RATE_BPS default 1800 = 18%.
  INVOICE_LEGAL_NAME: z.string().optional().default("InvoxAI"),
  INVOICE_GSTIN: z.string().optional().default(""),
  INVOICE_ADDRESS: z.string().optional().default(""),
  INVOICE_GST_RATE_BPS: z.coerce.number().int().optional().default(1800),

  // Sentry error reporting (Phase 1.4) — optional. When set, the apps report
  // server-side errors. Also exposed as NEXT_PUBLIC_SENTRY_DSN for the browser.
  SENTRY_DSN: z.string().optional().default(""),

  // Optional webhook (e.g. Slack) the monitor cron posts alerts to.
  ALERT_WEBHOOK_URL: z.string().optional().default(""),

  // Custom domains (Phase 15): the A-record target sellers point their domain at
  // (this VPS's public IP). Shown in the DNS setup instructions. SERVER ONLY.
  CUSTOM_DOMAIN_A_TARGET: z.string().optional().default("93.127.195.147"),

  // Symmetric key for encrypting seller gateway secrets at rest (C6).
  // base64 of 32 random bytes (`openssl rand -base64 32`). SERVER ONLY. Rotating
  // it invalidates existing ciphertexts (needs a re-encrypt migration). Optional
  // here so non-gateway deploys don't fail; the crypto helper throws clearly if
  // a gateway op runs without it.
  GATEWAY_ENCRYPTION_KEY: z.string().optional().default(""),

  // Email channel (Phase 14). RESEND_API_KEY enables real sending via Resend;
  // when empty, sendEmail() is a logged no-op (status "skipped") so nothing
  // blocks. EMAIL_FROM must be a Resend-verified sender (e.g. a verified
  // invoxai.io address). SERVER ONLY.
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().optional().default("InvoxAI <noreply@invoxai.io>"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

/**
 * Validate and return the server environment. Throws a readable, aggregated
 * error listing every missing/invalid variable so misconfiguration fails fast
 * and loudly at startup rather than deep inside a request.
 */
export function serverEnv(): ServerEnv {
  if (cached) return cached;
  loadEnv();

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `❌ Invalid or missing environment variables:\n${issues}\n\n` +
        `Copy .env.example to .env and fill in the values.`,
    );
  }

  cached = parsed.data;
  return cached;
}
