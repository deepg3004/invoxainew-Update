import { NextResponse, after, type NextRequest } from "next/server";
import { getBuyerPaymentByOrderId, markBuyerPaymentPaid } from "@invoxai/db";
import { getGatewayCredentials } from "../../../../lib/gateway";
import { verifyPaymentSignatureWithKeys } from "../../../../lib/razorpay";
import { notifySaleEffects } from "../../../../lib/notify-sale";

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

  // Best-effort seller/buyer notifications — only on a NEWLY-paid order (so a
  // refreshed callback can't duplicate them). Run AFTER the response via after():
  // notification + email work (now retried) must never delay or fail the buyer's
  // confirmation. notifySaleEffects never throws.
  if (!result.alreadyProcessed) {
    after(() =>
      notifySaleEffects({
        tenantId: payment.tenantId,
        buyerPaymentId: payment.id,
        itemTitle: payment.itemTitle,
        amountPaise: payment.amountPaise,
        commission: result.commission,
      }),
    );
  }

  return NextResponse.json({ ok: true });
}
