import type { Queue } from "bullmq";
import { NOTIFICATIONS_QUEUE, createQueueConnection } from "./connection";
import type { SaleNotificationPayload } from "./process-sale";

export const SALE_JOB = "sale";

// Lazily-created singleton Queue. bullmq is dynamically imported so the producer
// side (e.g. the tenant server bundle) doesn't statically pull bullmq in until a
// job is actually enqueued — i.e. only when the queue is enabled.
let queuePromise: Promise<Queue> | undefined;

async function getQueue(): Promise<Queue> {
  if (!queuePromise) {
    queuePromise = (async () => {
      const { Queue } = await import("bullmq");
      return new Queue(NOTIFICATIONS_QUEUE, { connection: createQueueConnection() });
    })();
  }
  return queuePromise;
}

/**
 * Enqueue the sale-notification job for a newly-PAID order. Returns true if the
 * job was accepted, false on any failure (Redis down, etc.) so the caller can
 * fall back to running it inline — notifications must not be silently dropped.
 *
 * The jobId is keyed on the buyerPaymentId, so a duplicate enqueue for the same
 * order is de-duplicated by BullMQ while the job still exists (mirrors the
 * fire-once intent of the inline path).
 */
export async function enqueueSaleNotification(
  payload: SaleNotificationPayload,
): Promise<boolean> {
  try {
    const queue = await getQueue();
    await queue.add(SALE_JOB, payload, {
      jobId: `sale:${payload.buyerPaymentId}`,
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600 },
    });
    return true;
  } catch {
    return false;
  }
}
