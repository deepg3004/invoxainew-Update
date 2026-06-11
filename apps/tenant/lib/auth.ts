import "server-only";
import type { User } from "@supabase/supabase-js";
import { supabaseServer } from "./supabase/server";

/**
 * The authenticated BUYER for this request, or null. Uses getUser() (validates
 * the JWT with Supabase), never the raw cookie, for authorization decisions.
 * Buyer sessions live on the tenant subdomain, separate from seller/admin.
 */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
