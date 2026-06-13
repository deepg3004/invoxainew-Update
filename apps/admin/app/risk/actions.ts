"use server";

import { revalidatePath } from "next/cache";
import { dismissRiskAlert } from "@invoxai/db";
import { requireAdmin } from "../../lib/auth";

/** Dismiss a risk alert (admin chose to ignore it), audited. */
export async function dismissRiskAlertAction(id: string) {
  const gate = await requireAdmin();
  if (!gate.ok) return;
  await dismissRiskAlert({ id, adminEmail: gate.user.email ?? "admin" });
  revalidatePath("/risk");
}
