"use server";

import { serverEnv } from "@invoxai/config";
import { createPlatformOrder, getFeatureRule } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";
import { createRazorpayOrder, razorpayConfigured } from "../../lib/razorpay";

export type FeaturePaymentResult =
  | { ok: false; error: string }
  | { ok: true; orderId: string; amountPaise: number; keyId: string };

/**
 * Begin a DIRECT platform-gateway payment for one use of a paid feature (e.g.
 * an AI page) — the alternative to debiting the wallet. The price is computed
 * server-side from the FeatureRule; a PlatformOrder(purpose=FEATURE, featureKey)
 * is persisted before checkout so the webhook/verify mints a server-trusted,
 * prepaid feature credit (consumed by the next consumeFeature for this feature).
 */
export async function startFeaturePayment(featureKey: string): Promise<FeaturePaymentResult> {
  const { tenant } = await requireTenant();

  const rule = await getFeatureRule(featureKey);
  if (!rule || !rule.active || !rule.directEnabled) {
    return { ok: false, error: "This feature isn’t available for direct payment." };
  }
  const gstPaise = Math.round((rule.basePaise * rule.gstRateBps) / 10000);
  const totalPaise = rule.basePaise + gstPaise;
  if (totalPaise <= 0) return { ok: false, error: "Nothing to pay for this feature." };

  if (!razorpayConfigured()) {
    return { ok: false, error: "Payments are not configured yet. Please try again later." };
  }

  const order = await createRazorpayOrder({
    amountPaise: totalPaise,
    receipt: `feat_${tenant.id}`.slice(0, 40),
    notes: { tenantId: tenant.id, purpose: "feature", featureKey },
  });

  await createPlatformOrder({
    razorpayOrderId: order.id,
    tenantId: tenant.id,
    purpose: "FEATURE",
    featureKey,
    amountPaise: totalPaise,
  });

  return {
    ok: true,
    orderId: order.id,
    amountPaise: totalPaise,
    keyId: serverEnv().NEXT_PUBLIC_RAZORPAY_KEY_ID,
  };
}
