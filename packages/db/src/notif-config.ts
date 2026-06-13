import { prisma } from "./client";

/**
 * Phase 14 (slice 3): admin-editable notification templates + per-tenant on/off
 * preferences. The EVENT CATALOG + defaults live in @invoxai/utils/notifications;
 * these helpers only persist overrides/toggles. Reads default to "use code default"
 * (no template row) and "enabled" (no preference row).
 */

/** All template overrides (admin editor). */
export function listNotificationTemplates() {
  return prisma.notificationTemplate.findMany({ orderBy: { eventKey: "asc" } });
}

/**
 * Admin upsert of an event's template (subject + body), audited. Platform-global
 * (no tenant). Writes an AdminAuditLog "notification.template_update" in the same
 * transaction so every copy change is traceable.
 */
export function upsertNotificationTemplate(input: {
  eventKey: string;
  channel?: string;
  subject: string;
  body: string;
  adminEmail: string;
}) {
  const channel = input.channel ?? "email";
  return prisma.$transaction(async (tx) => {
    await tx.notificationTemplate.upsert({
      where: { eventKey_channel: { eventKey: input.eventKey, channel } },
      update: { subject: input.subject, body: input.body },
      create: { eventKey: input.eventKey, channel, subject: input.subject, body: input.body },
    });
    await tx.adminAuditLog.create({
      data: {
        adminEmail: input.adminEmail,
        action: "notification.template_update",
        tenantId: null,
        detail: `${input.eventKey} (${channel})`,
      },
    });
  });
}

/** A tenant's notification preferences (seller panel). Scoped by tenantId. */
export function getNotificationPreferences(tenantId: string) {
  return prisma.notificationPreference.findMany({ where: { tenantId } });
}

/** Set one tenant preference on/off (seller-scoped upsert). */
export function setNotificationPreference(input: {
  tenantId: string;
  eventKey: string;
  channel?: string;
  enabled: boolean;
}) {
  const channel = input.channel ?? "email";
  return prisma.notificationPreference.upsert({
    where: {
      tenantId_eventKey_channel: { tenantId: input.tenantId, eventKey: input.eventKey, channel },
    },
    update: { enabled: input.enabled },
    create: { tenantId: input.tenantId, eventKey: input.eventKey, channel, enabled: input.enabled },
  });
}

/**
 * Everything the send path needs to dispatch this tenant's emails, in two queries:
 * the platform templates + this tenant's preferences. Returns lookups so a caller
 * resolves an event's override/enabled state without more round-trips.
 */
export async function getEmailDispatchConfig(tenantId: string) {
  const [templates, prefs] = await Promise.all([
    prisma.notificationTemplate.findMany({ where: { channel: "email" } }),
    prisma.notificationPreference.findMany({ where: { tenantId, channel: "email" } }),
  ]);
  return {
    template(eventKey: string) {
      return templates.find((t) => t.eventKey === eventKey) ?? null;
    },
    enabled(eventKey: string) {
      // No row = enabled by default.
      return prefs.find((p) => p.eventKey === eventKey)?.enabled ?? true;
    },
  };
}
