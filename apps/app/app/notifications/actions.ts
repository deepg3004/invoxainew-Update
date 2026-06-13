"use server";

import { revalidatePath } from "next/cache";
import {
  markNotificationRead,
  markAllNotificationsRead,
  setNotificationPreference,
} from "@invoxai/db";
import { getNotifEvent } from "@invoxai/utils/notifications";
import { requireTenant } from "../../lib/tenant";

/** Toggle an email notification on/off for this tenant. */
export async function setEmailPrefAction(eventKey: string, enabled: boolean) {
  if (!getNotifEvent(eventKey)) return;
  const { tenant } = await requireTenant();
  await setNotificationPreference({ tenantId: tenant.id, eventKey, channel: "email", enabled });
  revalidatePath("/notifications");
}

export async function markReadAction(id: string) {
  const { tenant } = await requireTenant();
  await markNotificationRead(tenant.id, id);
  revalidatePath("/notifications");
}

export async function markAllReadAction() {
  const { tenant } = await requireTenant();
  await markAllNotificationsRead(tenant.id);
  revalidatePath("/notifications");
  revalidatePath("/");
}
