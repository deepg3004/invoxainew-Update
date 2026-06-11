import { NextResponse, type NextRequest } from "next/server";
import {
  getPlatformOrderByRazorpayId,
  markPlatformOrderPaid,
  getTenantByOwnerId,
} from "@invoxai/db";
import { getSessionUser } from "../../../../lib/auth";
import { verifyPaymentSignature } from "../../../../lib/razorpay";

/**
 * Synchronous success path: Razorpay Checkout calls this from the browser after
 * a payment with { order_id, payment_id, signature }. We verify the signature,
 * confirm the order belongs to the caller's own tenant, then activate.
 *
 * This is best-effort UX (it lets us redirect the user immediately). The
 * webhook is the AUTHORITATIVE path; both call the same idempotent activation,
 * so a double-fire is harmless.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const orderId = body?.razorpay_order_id;
  const paymentId = body?.razorpay_payment_id;
  const signature = body?.razorpay_signature;

  if (!orderId || !paymentId || !signature) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 400 });
  }

  // Tenant isolation: the order must belong to the signed-in user's tenant.
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const tenant = await getTenantByOwnerId(user.id);
  const order = await getPlatformOrderByRazorpayId(orderId);
  if (!tenant || !order || order.tenantId !== tenant.id) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const result = await markPlatformOrderPaid({
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
