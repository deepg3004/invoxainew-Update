import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@invoxai/auth/ssr";

/**
 * Refreshes the Supabase session cookie on every request and guards routes:
 *  - unauthenticated → /login (preserving the intended path as ?next=)
 *  - authenticated on /login → home
 *
 * Runs in the Edge runtime, so it must not import Prisma or @invoxai/config
 * (node:fs). This only proves a SESSION exists — the admin allowlist check is
 * the real authorization boundary and lives in the page/action (Node runtime)
 * via requireAdmin(), which reads the server-only ADMIN_EMAILS.
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthPath = pathname === "/login" || pathname.startsWith("/auth");

  if (!user && !isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Exclude static assets and the public /health probe from auth.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|health|.*\\.).*)"],
};
