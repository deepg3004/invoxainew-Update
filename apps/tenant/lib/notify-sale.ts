import {
  enqueueSaleNotification,
  processSaleNotification,
  type SaleNotificationPayload,
} from "@invoxai/jobs";

/**
 * Fire the best-effort seller/buyer notifications for a newly-PAID order. Called
 * (via after()) from the Razorpay verify route and the manual-UPI auto-confirm
 * path, so both notify identically. NEVER throws.
 *
 * Delivery path is chosen by NOTIFICATIONS_USE_QUEUE:
 *  - "true"  → enqueue onto the BullMQ "notifications" queue; the standalone
 *              worker (infra/invox-worker.service) runs processSaleNotification.
 *              If the enqueue itself fails (e.g. Redis down) we fall back to
 *              running it inline so notifications are never silently dropped.
 *  - else    → run inline, exactly as before (DEFAULT — zero behaviour change
 *              until the worker is deployed and the flag is turned on).
 *
 * The actual work lives in @invoxai/jobs so the worker and the inline path share
 * one implementation.
 */
export async function notifySaleEffects(input: SaleNotificationPayload): Promise<void> {
  if (process.env.NOTIFICATIONS_USE_QUEUE === "true") {
    const queued = await enqueueSaleNotification(input).catch(() => false);
    if (queued) return;
    // Enqueue failed — fall through to inline so the notifications still go out.
  }
  await processSaleNotification(input).catch(() => {});
}
