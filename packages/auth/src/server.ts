import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@invoxai/config";

// Re-export the edge-safe, session-bound client so server components can get
// everything auth-related from "@invoxai/auth/server".
export {
  createServerSupabaseClient,
  type CookieAdapter,
  type CookieToSet,
} from "./ssr";

/**
 * Service-role client — bypasses RLS. SERVER ONLY (this module is guarded by
 * `import "server-only"`), never in the browser and never in Edge middleware.
 * Use only for trusted tasks (webhooks, admin jobs). Pulls in @invoxai/config,
 * which uses node:fs — another reason it must not reach the Edge runtime.
 */
export function createServiceClient(): SupabaseClient {
  const env = serverEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
