import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@invoxai/auth/ssr";

/**
 * Refreshes the Supabase session cookie on every request and guards routes:
 *  - unauthenticated → /login (preserving the intended path as ?next=)
 *  - authenticated on /login → home
 *
 * Runs in the Edge runtime, so it must not import Prisma or @invoxai/config
 * (node:fs). The tenant-existence guard lives in the page (Node runtime).
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
        // options is the framework-agnostic cookie shape from @supabase/ssr;
        // cast at this single Next boundary.
        response.cookies.set(name, value, options as Record<string, never>);
      }
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // /api/webhooks/* is called by external services (e.g. Razorpay) with no
  // session — it must never be redirected to /login. Its own handler verifies
  // the request via signature, not the session cookie.
  const isAuthPath =
    pathname === "/login" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/webhooks");

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
