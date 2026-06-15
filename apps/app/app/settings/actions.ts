"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setTenantName } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";
import { supabaseServer } from "../../lib/supabase/server";

/** Update the seller's display name (profile). Owner-scoped via requireTenant. */
export async function updateProfileAction(formData: FormData): Promise<void> {
  const { tenant } = await requireTenant();
  const raw = String(formData.get("name") ?? "").replace(/\s+/g, " ").trim();
  if (raw.length < 2 || raw.length > 80) {
    redirect("/settings?msg=name_invalid#profile");
  }
  await setTenantName(tenant.id, raw);
  revalidatePath("/settings");
  redirect("/settings?msg=name_saved#profile");
}

/** Change the signed-in user's password via Supabase Auth. Never logs the value. */
export async function changePasswordAction(formData: FormData): Promise<void> {
  // Authn check — redirects to /login if signed out.
  await requireTenant();
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (next.length < 8 || next.length > 200) {
    redirect("/settings?msg=pw_short#security");
  }
  if (next !== confirm) {
    redirect("/settings?msg=pw_mismatch#security");
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    redirect("/settings?msg=pw_failed#security");
  }
  redirect("/settings?msg=pw_saved#security");
}
