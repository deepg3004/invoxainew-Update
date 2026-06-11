import { NextResponse, type NextRequest } from "next/server";
import {
  recordPaymentEvent,
  markPlatformOrderPaid,
} from "@invoxai/db";
import { verifyWebhookSignature } from "../../../../lib/razorpay";

// Ensure the Node runtime (node:crypto + Prisma) and never cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authoritative payment path. Razorpay POSTs payment events here.
 *
 * Order of operations is the money-safety contract:
 *  1. Read the RAW body and verify the HMAC signature — reject anything
 *     unsigned/forged BEFORE parsing or trusting a single field.
 *  2. Record the event by its unique delivery id; a duplicate delivery is
 *     recognised and skipped (idempotent at the event layer).
 *  3. Activate via markOrderPaidAndActivate, which is itself idempotent at the
 *     order layer. Belt and suspenders — a redelivery never double-extends.
 *
 * Always 200 on accepted-but-unactionable events so Razorpay stops retrying;
 * only signature failures return 4xx.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature({ rawBody, signature })) {
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const type: string = event?.event ?? "unknown";

  // Razorpay sends a unique delivery id header; fall back to a stable composite.
  const orderEntity = event?.payload?.order?.entity;
  const paymentEntity = event?.payload?.payment?.entity;
  const razorpayOrderId: string | undefined =
    orderEntity?.id ?? paymentEntity?.order_id;
  const razorpayPaymentId: string | undefined = paymentEntity?.id;

  const eventId =
    request.headers.get("x-razorpay-event-id") ??
    `${type}:${razorpayOrderId ?? "?"}:${razorpayPaymentId ?? "?"}`;

  const { isNew } = await recordPaymentEvent({
    eventId,
    type,
    payload: event,
  });
  if (!isNew) {
    // Already processed this delivery — acknowledge without reprocessing.
    return NextResponse.json({ ok: true, deduped: true });
  }

  // We only act on successful-payment events; others are logged and ack'd.
  if ((type === "order.paid" || type === "payment.captured") && razorpayOrderId) {
    const result = await markPlatformOrderPaid({
      razorpayOrderId,
      razorpayPaymentId: razorpayPaymentId ?? null,
    });
    // order_not_found can happen for events from another environment — ack so
    // Razorpay stops retrying; the event is already logged for audit.
    return NextResponse.json({ ok: true, processed: result.ok });
  }

  return NextResponse.json({ ok: true, ignored: type });
}
