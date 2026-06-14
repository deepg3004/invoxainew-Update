"use server";

import { revalidatePath } from "next/cache";
import {
  createAffiliate,
  setAffiliateStatus,
  deleteAffiliate,
  logActivity,
  type AffiliateStatus,
} from "@invoxai/db";
import { percentStringToBps } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";

export type AffiliateFormState = { error?: string };

export async function createAffiliateAction(
  _prev: AffiliateFormState,
  form: FormData,
): Promise<AffiliateFormState> {
  const { tenant } = await requireTenant();

  const name = String(form.get("name") ?? "").trim();
  const code = String(form.get("code") ?? "").trim();
  const email = String(form.get("email") ?? "").trim() || null;

  const pct = percentStringToBps(String(form.get("commission") ?? ""));
  if (!pct.ok) return { error: `Commission: ${pct.message}` };

  const result = await createAffiliate(tenant.id, {
    name,
    code,
    email,
    commissionBps: pct.bps,
  });
  if (!result.ok) return { error: result.error };

  await logActivity(tenant.id, "affiliate.created").catch(() => {});
  revalidatePath("/affiliates");
  return {};
}

export async function setAffiliateStatusAction(id: string, status: AffiliateStatus) {
  const { tenant } = await requireTenant();
  await setAffiliateStatus(tenant.id, id, status);
  revalidatePath("/affiliates");
}

export async function deleteAffiliateAction(id: string) {
  const { tenant } = await requireTenant();
  await deleteAffiliate(tenant.id, id);
  revalidatePath("/affiliates");
}
