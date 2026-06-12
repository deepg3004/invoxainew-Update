import { NextResponse, type NextRequest } from "next/server";
import {
  getBuyerPaymentByOrderId,
  markBuyerPaymentPaid,
  notifyTenant,
  listSoldOutProductsForOrder,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { getGatewayCredentials } from "../../../../lib/gateway";
import { verifyPaymentSignatureWithKeys } from "../../../../lib/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Confirm a buyer payment (synchronous-verify model). The buyer is anonymous, so
 * authorization is the SIGNATURE, not a session: we look up the order, fetch the
 * owning seller's gateway secret, and verify HMAC(order|payment, sellerSecret).
 * Only then do we mark it PAID (idempotently) and charge the seller's commission.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const orderId = body?.razorpay_order_id;
  const paymentId = body?.razorpay_payment_id;
  const signature = body?.razorpay_signature;

  if (!orderId || !paymentId || !signature) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const payment = await getBuyerPaymentByOrderId(orderId);
  if (!payment) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const creds = await getGatewayCredentials(payment.tenantId);
  if (!creds) {
    return NextResponse.json({ ok: false, error: "no_gateway" }, { status: 409 });
  }

  const valid = verifyPaymentSignatureWithKeys({
    orderId,
    paymentId,
    signature,
    keySecret: creds.keySecret,
  });
  if (!valid) {
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 400 });
  }

  const result = await markBuyerPaymentPaid({
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 409 });
  }

  // Best-effort seller notifications — only on a NEWLY-paid order (so a refreshed
  // callback can't duplicate them), and never allowed to fail the confirmation.
  if (!result.alreadyProcessed) {
    try {
      await notifyTenant(payment.tenantId, {
        type: "sale",
        title: "New sale",
        body: `${payment.itemTitle ?? "Order"} — ${formatRupees(payment.amountPaise)}`,
        link: "/orders",
      });
      if (result.commission === "due") {
        await notifyTenant(payment.tenantId, {
          type: "wallet_low",
          title: "Wallet low — commission due",
          body: "A sale's commission couldn't be collected. Top up your wallet to clear it.",
          link: "/wallet",
        });
      }
      // Out-of-stock alerts: any product this sale took to zero stock.
      const soldOut = await listSoldOutProductsForOrder(payment.id);
      for (const pr of soldOut) {
        await notifyTenant(payment.tenantId, {
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

  return NextResponse.json({ ok: true });
}
