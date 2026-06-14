import { Worker, type Job } from "bullmq";
import { NOTIFICATIONS_QUEUE, createQueueConnection } from "./connection";
import { processSaleNotification, type SaleNotificationPayload } from "./process-sale";
import { SALE_JOB } from "./queue";

/**
 * Standalone BullMQ worker process for InvoxAI notifications. Run via
 * `pnpm --filter @invoxai/jobs worker` (tsx) under systemd — see
 * infra/invox-worker.service. Env (.env) is auto-loaded by @invoxai/config /
 * @invoxai/db at import, so no explicit dotenv call is needed here.
 *
 * Each job runs the SAME processSaleNotification used by the inline path, which
 * is best-effort and never throws — but if a transient infra error does bubble
 * up, BullMQ retries per the producer's attempts/backoff.
 */
const connection = createQueueConnection();

const worker = new Worker(
  NOTIFICATIONS_QUEUE,
  async (job: Job<SaleNotificationPayload>) => {
    if (job.name === SALE_JOB) {
      await processSaleNotification(job.data);
    }
  },
  { connection, concurrency: 5 },
);

worker.on("ready", () => console.log("[jobs] notification worker ready"));
worker.on("completed", (job) => console.log(`[jobs] completed ${job.id} (${job.name})`));
worker.on("failed", (job, err) =>
  console.error(`[jobs] failed ${job?.id ?? "?"} (${job?.name ?? "?"}): ${err?.message ?? err}`),
);
worker.on("error", (err) => console.error("[jobs] worker error:", err?.message ?? err));

console.log("[jobs] starting notification worker…");

async function shutdown(signal: string): Promise<void> {
  console.log(`[jobs] ${signal} received — closing worker…`);
  try {
    await worker.close();
    await connection.quit();
  } finally {
    process.exit(0);
  }
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
