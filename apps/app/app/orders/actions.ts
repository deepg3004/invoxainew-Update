"use server";

import { revalidatePath } from "next/cache";
import {
  updateOrderFulfillment,
  setOrderFulfillmentStatus,
  getRefundableOrder,
  recordRefund,
  logActivity,
} from "@invoxai/db";
import { rupeeStringToPaise, formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { getGatewayCredentials } from "../../lib/gateway";
import { refundPayment } from "../../lib/razorpay";

const STATUSES = ["NEW", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
type Status = (typeof STATUSES)[number];

/**
 * Update an order's fulfillment status + tracking note. Scoped to the seller's
 * own tenant (the DB write filters by tenantId, so a forged id can't touch
 * another seller's order). Used as a form action — bound to the order id.
 */
export async function updateOrderFulfillmentAction(id: string, form: FormData) {
  const { tenant } = await requireTenant();

  const raw = String(form.get("status") ?? "");
  const status = (STATUSES as readonly string[]).includes(raw)
    ? (raw as Status)
    : "NEW";
  const note = String(form.get("note") ?? "").trim() || null;

  await updateOrderFulfillment(tenant.id, id, status, note);
  revalidatePath("/orders");
}

/**
 * One-tap advance to the next fulfillment status (status-only, keeps the note).
 * The target is validated against the allowed statuses; the DB write is tenant-
 * scoped, so a forged id/target can't touch another seller's order.
 */
export async function advanceOrderAction(id: string, next: string) {
  const { tenant } = await requireTenant();
  if (!(STATUSES as readonly string[]).includes(next)) return;
  await setOrderFulfillmentStatus(tenant.id, id, next as Status);
  revalidatePath("/orders");
}

export type RefundState = { error?: string; ok?: string };

/**
 * Refund a buyer (Phase 1). The refund executes on the SELLER's gateway, then we
 * record it and reverse the proportional commission. Order matters: Razorpay
 * first (money), then recordRefund (books, idempotent on the refund id).
 */
export async function refundOrderAction(
  buyerPaymentId: string,
  _prev: RefundState,
  form: FormData,
): Promise<RefundState> {
  const { tenant } = await requireTenant();

  const order = await getRefundableOrder(tenant.id, buyerPaymentId);
  if (!order) return { error: "Order not found or not refundable." };
  if (!order.razorpayPaymentId) {
    return { error: "No payment reference on this order — can't refund." };
  }

  const remaining = order.amountPaise - order.refundedPaise;
  const amt = rupeeStringToPaise(String(form.get("amount") ?? ""));
  if (!amt.ok) return { error: `Amount: ${amt.message}` };
  if (amt.paise <= 0 || amt.paise > remaining) {
    return { error: "Amount must be between ₹0 and the remaining refundable amount." };
  }

  const creds = await getGatewayCredentials(tenant.id);
  if (!creds) return { error: "Your payment gateway isn’t connected." };

  let refundId: string;
  try {
    const refund = await refundPayment({
      keyId: creds.keyId,
      keySecret: creds.keySecret,
      paymentId: order.razorpayPaymentId,
      amountPaise: amt.paise,
    });
    refundId = refund.id;
  } catch (e) {
    console.error("Razorpay refund failed", e);
    return { error: "The gateway refused the refund. Check the amount and try again." };
  }

  const result = await recordRefund({
    buyerPaymentId: order.id,
    tenantId: tenant.id,
    razorpayRefundId: refundId,
    amountPaise: amt.paise,
  });
  if (!result.ok) {
    // The money WAS refunded on the gateway; our books couldn't update.
    console.error("recordRefund failed after gateway refund", refundId, result.reason);
    return { error: "Refund issued, but recording it failed — contact support with the order id." };
  }

  await logActivity(tenant.id, "order.refunded", formatRupees(amt.paise)).catch(() => {});
  revalidatePath("/orders");
  return {
    ok: `Refunded. Commission reversed: ${(result.commissionReversedPaise / 100).toFixed(2)} INR.`,
  };
}
