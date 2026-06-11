import "server-only";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@invoxai/auth/server";

/**
 * Supabase client for Server Components / Route Handlers / Server Actions,
 * bound to the request's cookies. In a Server Component the cookie store is
 * read-only, so `setAll` may throw — we swallow that because the middleware is
 * responsible for writing refreshed session cookies.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerSupabaseClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) => {
      try {
        for (const { name, value, options } of toSet) {
          cookieStore.set(name, value, options);
        }
      } catch {
        // Read-only cookie context (Server Component) — safe to ignore.
      }
    },
  });
}
