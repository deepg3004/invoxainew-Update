import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Edge-safe, request-scoped Supabase client bound to the user's session
 * cookies (anon key). Used by Next.js middleware (Edge runtime) and server
 * components/route handlers.
 *
 * Deliberately imports NOTHING that touches node:fs (no @invoxai/config) and
 * not `server-only`, so it is safe to bundle for the Edge runtime. It reads the
 * public env vars directly — these are inlined by Next at build time.
 */
export type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export interface CookieAdapter {
  getAll(): { name: string; value: string }[];
  setAll(cookies: CookieToSet[]): void;
}

export function createServerSupabaseClient(
  cookies: CookieAdapter,
): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createServerClient(url, anonKey, { cookies });
}
