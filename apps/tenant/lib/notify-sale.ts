import { notifyTenant, listSoldOutProductsForOrder } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";

/**
 * Best-effort seller notifications fired after a NEWLY-PAID order — the sale, a
 * commission-due nudge, and any product the sale took to zero stock. Shared by the
 * Razorpay verify route and the manual-UPI auto-confirm path so both notify
 * identically. NEVER throws: a notification failure must not affect the payment.
 */
export async function notifySaleEffects(input: {
  tenantId: string;
  buyerPaymentId: string;
  itemTitle: string | null;
  amountPaise: number;
  commission: "paid" | "due" | "none";
}): Promise<void> {
  try {
    await notifyTenant(input.tenantId, {
      type: "sale",
      title: "New sale",
      body: `${input.itemTitle ?? "Order"} — ${formatRupees(input.amountPaise)}`,
      link: "/orders",
    });
    if (input.commission === "due") {
      await notifyTenant(input.tenantId, {
        type: "wallet_low",
        title: "Wallet low — commission due",
        body: "A sale's commission couldn't be collected. Top up your wallet to clear it.",
        link: "/wallet",
      });
    }
    const soldOut = await listSoldOutProductsForOrder(input.buyerPaymentId);
    for (const pr of soldOut) {
      await notifyTenant(input.tenantId, {
        type: "out_of_stock",
        title: "Out of stock",
        body: `“${pr.title}” just sold out — restock it to keep selling.`,
        link: "/products",
      });
    }
  } catch {
    // Swallow: a notification failure must not affect the payment outcome.
  }
}
