"use server";

import { revalidatePath } from "next/cache";
import { upsertNotificationTemplate } from "@invoxai/db";
import { getNotifEvent } from "@invoxai/utils/notifications";
import { requireAdmin } from "../../../lib/auth";

export type TemplateFormState = { error?: string; ok?: boolean; savedKey?: string };

/** Save one event's email template (subject + body). Admin-only + audited. */
export async function saveTemplateAction(
  _prev: TemplateFormState,
  form: FormData,
): Promise<TemplateFormState> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: "Not authorized." };

  const eventKey = String(form.get("eventKey") ?? "");
  const subject = String(form.get("subject") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();

  const event = getNotifEvent(eventKey);
  if (!event) return { error: "Unknown notification event." };
  if (!subject || !body) return { error: "Subject and message are both required." };
  if (subject.length > 200) return { error: "Subject is too long (max 200 characters)." };
  if (body.length > 2000) return { error: "Message is too long (max 2000 characters)." };

  await upsertNotificationTemplate({
    eventKey,
    channel: "email",
    subject,
    body,
    adminEmail: gate.user.email ?? "admin",
  });
  revalidatePath("/notifications/templates");
  return { ok: true, savedKey: eventKey };
}
