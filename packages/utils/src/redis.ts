import Redis from "ioredis";
import { serverEnv } from "@invoxai/config";

/**
 * Redis (ioredis) singleton.
 *
 * Cached on globalThis for the same reason as Prisma: avoid opening a new
 * connection on every Next.js hot-reload in development. Server-only.
 */
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export function getRedis(): Redis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(serverEnv().REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
  }
  return globalForRedis.redis;
}

export { Redis };
