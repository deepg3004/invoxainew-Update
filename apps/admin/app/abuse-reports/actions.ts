"use server";

import { revalidatePath } from "next/cache";
import { reviewAbuseReport } from "@invoxai/db";
import { requireAdmin } from "../../lib/auth";

const STATUSES = new Set(["NEW", "REVIEWING", "ACTIONED", "DISMISSED"]);

/** Triage one report: set status + optional note (audited). Admin-only. */
export async function reviewAbuseReportAction(form: FormData) {
  const gate = await requireAdmin();
  if (!gate.ok) return;

  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  const note = String(form.get("note") ?? "").trim();
  if (!id || !STATUSES.has(status)) return;

  await reviewAbuseReport({
    id,
    status: status as "NEW" | "REVIEWING" | "ACTIONED" | "DISMISSED",
    adminNote: note || null,
    adminEmail: gate.user.email ?? "admin",
  });
  revalidatePath("/abuse-reports");
}
