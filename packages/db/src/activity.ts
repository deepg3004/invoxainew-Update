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

/** A seller's recent activity, newest first. Scoped by tenantId. */
export function listActivityLog(tenantId: string, take = 50) {
  return prisma.activityLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
