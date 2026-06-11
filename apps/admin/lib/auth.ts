import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { serverEnv } from "@invoxai/config";
import { supabaseServer } from "./supabase/server";

/**
 * The authenticated Supabase user for this request, or null.
 *
 * Always uses `getUser()` (which validates the JWT with Supabase) rather than
 * `getSession()` (which trusts the cookie) — never trust the cookie for
 * authorization decisions.
 */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The lowercased admin allowlist parsed from ADMIN_EMAILS (server-only). */
function adminEmailSet(): Set<string> {
  return new Set(
    serverEnv()
      .ADMIN_EMAILS.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Is this email on the platform-admin allowlist? Case-insensitive. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmailSet().has(email.trim().toLowerCase());
}

export type AdminGate =
  | { ok: true; user: User }
  | { ok: false; user: User; reason: "not_allowlisted" };

/**
 * Authorization gate for every admin page/action. Redirects to /login when
 * unauthenticated. When signed in but NOT on the ADMIN_EMAILS allowlist, returns
 * a non-ok result so the caller can render a "Not authorized" screen (rather
 * than bouncing to /login, which would loop a logged-in non-admin forever).
 *
 * SECURITY: this is the real authorization boundary. The Edge middleware only
 * proves a session exists; the allowlist check must run here in the Node runtime
 * (it reads the server-only ADMIN_EMAILS) and must be called by every mutation.
 */
export async function requireAdmin(): Promise<AdminGate> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) {
    return { ok: false, user, reason: "not_allowlisted" };
  }
  return { ok: true, user };
}
