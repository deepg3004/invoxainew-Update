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
