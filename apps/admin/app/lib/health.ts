import "server-only";
import { prisma } from "@invoxai/db";
import { getRedis } from "@invoxai/utils";

export type HealthResult = {
  ok: boolean;
  checks: {
    db: { ok: boolean; error?: string };
    redis: { ok: boolean; error?: string };
  };
};

/**
 * Liveness probe used by both the /health route and the status page.
 * Confirms Postgres (Supabase, via Prisma) and Redis are reachable.
 */
export async function checkHealth(): Promise<HealthResult> {
  const checks: HealthResult["checks"] = {
    db: { ok: false },
    redis: { ok: false },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db.ok = true;
  } catch (e) {
    checks.db.error = e instanceof Error ? e.message : String(e);
  }

  try {
    const pong = await getRedis().ping();
    checks.redis.ok = pong === "PONG";
    if (!checks.redis.ok) checks.redis.error = `unexpected reply: ${pong}`;
  } catch (e) {
    checks.redis.error = e instanceof Error ? e.message : String(e);
  }

  return { ok: checks.db.ok && checks.redis.ok, checks };
}
