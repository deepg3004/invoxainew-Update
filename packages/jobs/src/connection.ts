import { Redis } from "ioredis";
import { serverEnv } from "@invoxai/config";

/** The single notification queue name (producer + worker must agree). */
export const NOTIFICATIONS_QUEUE = "notifications";

/**
 * A fresh ioredis connection configured for BullMQ. BullMQ REQUIRES
 * `maxRetriesPerRequest: null` on the connection its blocking commands use —
 * unlike the app's shared getRedis() (which caps retries), so we make a dedicated
 * one here. Callers own the connection's lifetime.
 */
export function createQueueConnection(): Redis {
  return new Redis(serverEnv().REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
