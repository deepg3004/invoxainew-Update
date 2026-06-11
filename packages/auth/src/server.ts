import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@invoxai/config";

/**
 * Server-only Supabase client using the SERVICE-ROLE key.
 *
 * The service-role key bypasses Row Level Security, so this client must NEVER
 * be created in code that can reach the browser. The `import "server-only"`
 * above makes Next.js fail the build if this module is ever pulled into a
 * client bundle — a structural guardrail, not just a convention.
 *
 * Use this only for trusted server tasks (webhooks, admin jobs). For
 * per-user requests, prefer a request-scoped client that respects RLS.
 */
export function createServiceClient(): SupabaseClient {
  const env = serverEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
