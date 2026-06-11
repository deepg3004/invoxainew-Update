import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser/anon Supabase client.
 *
 * Reads ONLY the public anon key and URL (the NEXT_PUBLIC_* values Next.js
 * inlines into the client bundle). Access control is enforced server-side by
 * Row Level Security — never the anon key alone.
 *
 * This file intentionally has no access to the service-role key.
 */
export function createAnonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createClient(url, anonKey);
}
