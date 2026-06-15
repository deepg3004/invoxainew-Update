import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getTenantByOwnerId } from "@invoxai/db";
import { getSessionUser } from "./auth";

export interface AuthedTenant {
  user: User;
  tenant: { id: string; username: string; name: string | null; stateCode: string | null; storeTheme: string | null };
}

/**
 * Resolve the authenticated seller AND their tenant in one step, the way every
 * seller-scoped page/action should start. Redirects to /login when signed out
 * and to /onboarding when the user has no tenant yet. The returned tenant.id is
 * the ONLY tenant id callers should scope by — never trust a tenant id from
 * request input.
 */
export async function requireTenant(): Promise<AuthedTenant> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const tenant = await getTenantByOwnerId(user.id);
  if (!tenant) redirect("/onboarding");
  return {
    user,
    tenant: {
      id: tenant.id,
      username: tenant.username,
      name: tenant.name,
      stateCode: tenant.stateCode,
      storeTheme: tenant.storeTheme,
    },
  };
}
