import { NextResponse, type NextRequest } from "next/server";
import {
  claimPaymentEvent,
  markPaymentEventProcessed,
  recordPaymentEventError,
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

  // Claim the event. `alreadyProcessed` is true only if a PRIOR delivery
  // COMPLETED — an event recorded but failed mid-processing is reprocessed
  // (retry-safe; the handlers below are idempotent).
  const { alreadyProcessed } = await claimPaymentEvent({ eventId, type, payload: event });
  if (alreadyProcessed) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  try {
    // We only act on successful-payment events; others are terminal no-ops.
    if ((type === "order.paid" || type === "payment.captured") && razorpayOrderId) {
      await markPlatformOrderPaid({
        razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId ?? null,
      });
      // order_not_found (e.g. event from another environment) is terminal — we
      // still mark processed below so Razorpay stops retrying.
    }
    await markPaymentEventProcessed(eventId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Transient failure: record it and return 500 so Razorpay redelivers. The
    // event stays unprocessed, so the redelivery reprocesses it.
    const message = e instanceof Error ? e.message : String(e);
    console.error("webhook processing failed", eventId, message);
    await recordPaymentEventError(eventId, message).catch(() => {});
    return NextResponse.json({ ok: false, error: "processing_failed" }, { status: 500 });
  }
}
