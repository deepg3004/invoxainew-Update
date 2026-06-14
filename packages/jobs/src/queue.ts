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

export type QueueHealth = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
};

/**
 * Live job counts for the notifications queue (admin observability). Returns null
 * if the queue is unreachable (e.g. Redis down) so the caller can show a degraded
 * state instead of throwing. Read-only.
 */
export async function getNotificationsQueueHealth(): Promise<QueueHealth | null> {
  try {
    const queue = await getQueue();
    const c = await queue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
      "paused",
    );
    return {
      waiting: c.waiting ?? 0,
      active: c.active ?? 0,
      completed: c.completed ?? 0,
      failed: c.failed ?? 0,
      delayed: c.delayed ?? 0,
      paused: c.paused ?? 0,
    };
  } catch {
    return null;
  }
}
