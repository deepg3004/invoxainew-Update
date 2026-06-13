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

/**
 * Phase 14 (slice 2): record one outbound-channel notification attempt. Append-
 * only audit of what we sent (or skipped/failed). Best-effort — the caller wraps
 * it so a logging failure never affects the triggering action.
 */
export function recordNotificationLog(input: {
  tenantId: string;
  channel?: string;
  eventType: string;
  recipient: string;
  subject?: string | null;
  status: "sent" | "failed" | "skipped";
  providerMessageId?: string | null;
  error?: string | null;
}) {
  return prisma.notificationLog.create({
    data: {
      tenantId: input.tenantId,
      channel: input.channel ?? "email",
      eventType: input.eventType,
      recipient: input.recipient,
      subject: input.subject ?? null,
      status: input.status,
      providerMessageId: input.providerMessageId ?? null,
      error: input.error ?? null,
    },
    select: { id: true },
  });
}

/** A tenant's outbound-notification log, newest first. Scoped by tenantId. */
export function listNotificationLogs(tenantId: string, take = 50) {
  return prisma.notificationLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/**
 * Everything the email notifications need about a newly-paid order, in one query:
 * the buyer's email + item/amount, plus the seller store (username/name) and the
 * owner's email. Returns null if the payment is gone. Read server-side only.
 */
export function getOrderNotifyContext(buyerPaymentId: string) {
  return prisma.buyerPayment.findUnique({
    where: { id: buyerPaymentId },
    select: {
      buyerEmail: true,
      itemTitle: true,
      amountPaise: true,
      tenant: {
        select: {
          username: true,
          name: true,
          owner: { select: { email: true } },
          // Phase 15: the seller's canonical custom domain (if any), so the
          // buyer-receipt "Visit store" link prefers it over the subdomain.
          domains: {
            where: { isPrimary: true, status: "VERIFIED" },
            select: { domain: true },
            take: 1,
          },
        },
      },
    },
  });
}
