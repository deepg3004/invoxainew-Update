import { prisma } from "./client";

/**
 * Notifications engine (slice 1) — seller-facing in-app notifications.
 *
 * Notifications are a best-effort SIDE EFFECT of events (a sale, a low wallet),
 * created AFTER the money path commits — never inside a payment transaction, so a
 * notification failure can never roll back or block a payment. Callers fire them
 * only on a newly-PAID order (not on webhook/callback replays), so they are not
 * duplicated. Everything here is tenant-scoped.
 *
 * Slice 2 will add channels (email via an env-gated provider) + buyer-facing
 * notifications + admin-editable templates.
 */

/** Create a notification for a tenant (best-effort; caller may ignore failures). */
export function notifyTenant(
  tenantId: string,
  input: { type: string; title: string; body?: string | null; link?: string | null },
) {
  return prisma.notification.create({
    data: {
      tenantId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    },
    select: { id: true },
  });
}

/** A tenant's notifications, newest first. Scoped by tenantId. */
export function listNotifications(tenantId: string, take = 50) {
  return prisma.notification.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** Count of unread notifications for the dashboard badge. Scoped by tenantId. */
export function countUnreadNotifications(tenantId: string) {
  return prisma.notification.count({ where: { tenantId, readAt: null } });
}

/** Mark one notification read (seller-scoped via updateMany). */
export function markNotificationRead(tenantId: string, id: string) {
  return prisma.notification.updateMany({
    where: { id, tenantId, readAt: null },
    data: { readAt: new Date() },
  });
}

/** Mark all of a tenant's unread notifications read. Scoped by tenantId. */
export function markAllNotificationsRead(tenantId: string) {
  return prisma.notification.updateMany({
    where: { tenantId, readAt: null },
    data: { readAt: new Date() },
  });
}
