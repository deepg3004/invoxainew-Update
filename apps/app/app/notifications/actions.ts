"use server";

import { revalidatePath } from "next/cache";
import { markNotificationRead, markAllNotificationsRead } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";

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
