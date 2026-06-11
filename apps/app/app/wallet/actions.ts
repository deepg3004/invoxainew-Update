"use server";

import { serverEnv } from "@invoxai/config";
import { createPlatformOrder } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";
import { createRazorpayOrder, razorpayConfigured } from "../../lib/razorpay";

// Top-up bounds (integer paise). ₹10 min keeps gateway fees sane; ₹1,00,000 cap
// is a sanity guard against a fat-fingered amount.
const MIN_TOPUP_PAISE = 1000;
const MAX_TOPUP_PAISE = 10_000_000;

export type TopupResult =
  | { ok: false; error: string }
  | {
      ok: true;
      orderId: string;
      amountPaise: number;
      keyId: string;
    };

/**
 * Begin a wallet top-up via the platform gateway. The wallet holds only the
 * seller's money for InvoxAI fees (hard rule). Tenant comes from the session;
 * the amount is validated server-side; a PlatformOrder(purpose=WALLET_TOPUP) is
 * persisted before checkout so the webhook credits a server-trusted amount.
 */
export async function startWalletTopup(amountPaise: number): Promise<TopupResult> {
  const { tenant } = await requireTenant();

  if (!Number.isInteger(amountPaise) || amountPaise < MIN_TOPUP_PAISE) {
    return { ok: false, error: "Minimum top-up is ₹10." };
  }
  if (amountPaise > MAX_TOPUP_PAISE) {
    return { ok: false, error: "Top-up exceeds the ₹1,00,000 limit." };
  }
  if (!razorpayConfigured()) {
    return { ok: false, error: "Payments are not configured yet. Please try again later." };
  }

  const order = await createRazorpayOrder({
    amountPaise,
    receipt: `wallet_${tenant.id}`.slice(0, 40),
    notes: { tenantId: tenant.id, purpose: "wallet_topup" },
  });

  await createPlatformOrder({
    razorpayOrderId: order.id,
    tenantId: tenant.id,
    purpose: "WALLET_TOPUP",
    amountPaise,
  });

  return {
    ok: true,
    orderId: order.id,
    amountPaise,
    keyId: serverEnv().NEXT_PUBLIC_RAZORPAY_KEY_ID,
  };
}
