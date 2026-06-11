import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "../../../lib/supabase/server";
import { requestOrigin } from "../../../lib/origin";

// OAuth (Google) redirects here with ?code=… — exchange it for a session,
// which sets the cookies, then continue to the intended page.
export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
