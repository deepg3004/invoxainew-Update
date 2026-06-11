import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { requestOrigin } from "../../../../lib/origin";

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${requestOrigin(request)}/`, { status: 303 });
}
