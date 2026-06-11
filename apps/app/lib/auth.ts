import "server-only";
import type { User } from "@supabase/supabase-js";
import { supabaseServer } from "./supabase/server";

/**
 * The authenticated Supabase user for this request, or null.
 *
 * Always uses `getUser()` (which validates the JWT with Supabase) rather than
 * `getSession()` (which trusts the cookie) — never trust the session cookie for
 * authorization decisions.
 */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
