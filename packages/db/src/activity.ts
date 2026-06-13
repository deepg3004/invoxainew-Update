import { prisma } from "./client";

/**
 * Seller activity log. `logActivity` is best-effort — callers `.catch(() => {})`
 * it AFTER the real operation, so a log failure can never affect the action.
 */
export function logActivity(tenantId: string, action: string, detail?: string | null) {
  return prisma.activityLog.create({
    data: { tenantId, action, detail: detail ?? null },
  });
}

/** A seller's recent activity, newest first. Scoped by tenantId. Paginated. */
export function listActivityLog(tenantId: string, opts: { skip?: number; take?: number } = {}) {
  return prisma.activityLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    skip: opts.skip,
    take: opts.take ?? 50,
  });
}

/** Total activity entries for the tenant (drives pagination). */
export function countActivityLog(tenantId: string) {
  return prisma.activityLog.count({ where: { tenantId } });
}
