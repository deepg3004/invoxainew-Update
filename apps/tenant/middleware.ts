import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@invoxai/auth/ssr";

/**
 * Buyer session-cookie refresh for the Buyer Corner (C8).
 *
 * Scoped to /account/* ONLY — the rest of the tenant site (the public storefront
 * and payment pages) must stay open to anonymous visitors, so we never run auth
 * there. This refreshes the buyer's Supabase session but NEVER redirects; the
 * /account page itself sends anonymous buyers to /account/login.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerSupabaseClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet) => {
      for (const { name, value } of cookiesToSet) {
        request.cookies.set(name, value);
      }
      response = NextResponse.next({ request });
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options as Record<string, never>);
      }
    },
  });

  // Touching getUser() refreshes the session cookie when needed.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/account/:path*"],
};
