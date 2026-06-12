import "server-only";
import {
  getPlatformOrderByRazorpayId,
  notifyTenant,
  type PaidOrderResult,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";

/**
 * Fire a seller in-app notification for a PAID platform order (wallet top-up or
 * subscription). BEST-EFFORT side effect: only on a NEWLY-paid order (so the
 * synchronous verify and the webhook — both of which call the idempotent
 * markPlatformOrderPaid — don't double-notify), and never allowed to throw into
 * the caller (a notification failure must not affect the payment outcome).
 */
export async function notifyOnPlatformPaid(
  razorpayOrderId: string,
  result: PaidOrderResult,
): Promise<void> {
  if (!result.ok || result.alreadyProcessed) return;
  try {
    const order = await getPlatformOrderByRazorpayId(razorpayOrderId);
    if (!order) return;
    if (result.purpose === "WALLET_TOPUP") {
      await notifyTenant(order.tenantId, {
        type: "wallet_topup",
        title: "Wallet topped up",
        body: `${formatRupees(order.amountPaise)} added to your wallet.`,
        link: "/wallet",
      });
    } else {
      await notifyTenant(order.tenantId, {
        type: "subscription",
        title: "Subscription active",
        body: "Your plan payment was received — you're all set.",
        link: "/billing",
      });
    }
  } catch {
    // Swallow — notifications are non-critical.
  }
}
