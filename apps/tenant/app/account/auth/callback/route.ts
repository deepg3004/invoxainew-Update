import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { requestOrigin } from "../../../../lib/origin";

// OAuth (Google) returns here with ?code=… — exchange for a session (sets
// cookies on this tenant subdomain), then continue. Stays on THIS host.
export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/account";

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/account/login?error=auth`);
}
