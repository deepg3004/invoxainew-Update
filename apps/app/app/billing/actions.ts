"use server";

import { revalidatePath } from "next/cache";
import { serverEnv } from "@invoxai/config";
import {
  getPlanById,
  createPlatformOrder,
  activateFreePlan,
} from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";
import { createRazorpayOrder, razorpayConfigured } from "../../lib/razorpay";

export type StartCheckoutResult =
  | { ok: false; error: string }
  | { ok: true; kind: "free" } // ₹0 plan activated, no checkout needed
  | {
      ok: true;
      kind: "order";
      orderId: string;
      amountPaise: number;
      keyId: string;
      planName: string;
    };

type Cycle = "MONTHLY" | "YEARLY";

/**
 * Begin subscribing the authenticated seller's tenant to a plan.
 *
 * SECURITY: the tenant comes from the session (requireTenant), the price comes
 * from the DB plan (never the client), and we persist a PlatformOrder mapping
 * the Razorpay order → tenant/plan/amount BEFORE checkout, so confirmation is
 * validated against server-trusted data. Free (₹0) plans activate directly.
 */
export async function startCheckout(
  planId: string,
  cycle: Cycle,
): Promise<StartCheckoutResult> {
  const { tenant } = await requireTenant();

  const plan = await getPlanById(planId);
  if (!plan || !plan.isActive) {
    return { ok: false, error: "That plan is not available." };
  }

  const amountPaise = cycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly;

  // Free tier: no gateway round-trip.
  if (amountPaise <= 0) {
    await activateFreePlan({ tenantId: tenant.id, planId: plan.id, billingCycle: cycle });
    revalidatePath("/billing");
    return { ok: true, kind: "free" };
  }

  if (!razorpayConfigured()) {
    return { ok: false, error: "Payments are not configured yet. Please try again later." };
  }

  const order = await createRazorpayOrder({
    amountPaise,
    receipt: `sub_${tenant.id}_${plan.key}_${cycle}`.slice(0, 40),
    notes: { tenantId: tenant.id, planId: plan.id, cycle },
  });

  await createPlatformOrder({
    razorpayOrderId: order.id,
    tenantId: tenant.id,
    planId: plan.id,
    billingCycle: cycle,
    amountPaise,
  });

  return {
    ok: true,
    kind: "order",
    orderId: order.id,
    amountPaise,
    keyId: serverEnv().NEXT_PUBLIC_RAZORPAY_KEY_ID,
    planName: plan.name,
  };
}
