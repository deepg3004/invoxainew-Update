"use server";

import { revalidatePath } from "next/cache";
import { setTenantSuspended, adminAdjustWallet, markChargeback } from "@invoxai/db";
import { rupeeStringToPaise } from "@invoxai/utils/money";
import { requireAdmin } from "../../../lib/auth";

export type WalletAdjustState = { error?: string; ok?: string };

/** Suspend / un-suspend a tenant (form action). Audited with the admin's email. */
export async function toggleSuspendAction(
  id: string,
  suspend: boolean,
  form: FormData,
) {
  const gate = await requireAdmin();
  if (!gate.ok) return;
  const reason = String(form.get("reason") ?? "").trim() || null;
  await setTenantSuspended({
    tenantId: id,
    suspended: suspend,
    adminEmail: gate.user.email ?? "unknown",
    reason,
  });
  revalidatePath(`/tenants/${id}`);
}

/** Mark a chargeback on an order (form action). Reverses commission + audits. */
export async function markChargebackAction(
  tenantId: string,
  orderId: string,
) {
  const gate = await requireAdmin();
  if (!gate.ok) return;
  await markChargeback({ tenantId, orderId, adminEmail: gate.user.email ?? "unknown" });
  revalidatePath(`/tenants/${tenantId}`);
}

/** Manual wallet credit/debit (useActionState). Validates + audits. */
export async function adjustWalletAction(
  id: string,
  _prev: WalletAdjustState,
  form: FormData,
): Promise<WalletAdjustState> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: "Not authorized." };

  const direction = String(form.get("direction") ?? "");
  if (direction !== "CREDIT" && direction !== "DEBIT") {
    return { error: "Choose credit or debit." };
  }
  const amount = rupeeStringToPaise(String(form.get("amount") ?? ""));
  if (!amount.ok) return { error: `Amount: ${amount.message}` };
  if (amount.paise <= 0) return { error: "Amount must be greater than ₹0." };
  const reason = String(form.get("reason") ?? "").trim();
  if (!reason) return { error: "A reason is required (it's logged)." };

  const result = await adminAdjustWallet({
    tenantId: id,
    direction,
    amountPaise: amount.paise,
    reason,
    adminEmail: gate.user.email ?? "unknown",
  });
  if (!result.ok) {
    return { error: "Debit would make the wallet negative — reduce the amount." };
  }
  revalidatePath(`/tenants/${id}`);
  return { ok: `Wallet ${direction.toLowerCase()}ed. New balance updated.` };
}
