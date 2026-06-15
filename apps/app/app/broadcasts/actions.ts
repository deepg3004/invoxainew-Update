"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createBroadcast,
  updateBroadcast,
  deleteBroadcast,
  cancelBroadcast,
  queueBroadcast,
  normalizeSegment,
  type BroadcastSegment,
} from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";

export type BroadcastFormState = { error?: string };

function parse(
  form: FormData,
):
  | { ok: true; name: string; subject: string; body: string; segment: BroadcastSegment }
  | { ok: false; message: string } {
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return { ok: false, message: "Name must be 2–80 characters." };
  }
  const subject = String(form.get("subject") ?? "").trim();
  if (subject.length < 2 || subject.length > 150) {
    return { ok: false, message: "Subject must be 2–150 characters." };
  }
  const body = String(form.get("body") ?? "").trim();
  if (body.length < 2 || body.length > 5000) {
    return { ok: false, message: "Message must be 2–5000 characters." };
  }
  const segment = normalizeSegment(form.get("segment"));
  return { ok: true, name, subject, body, segment };
}

export async function createBroadcastAction(
  _prev: BroadcastFormState,
  form: FormData,
): Promise<BroadcastFormState> {
  const { tenant } = await requireTenant();
  const parsed = parse(form);
  if (!parsed.ok) return { error: parsed.message };

  const { id } = await createBroadcast(tenant.id, parsed);
  revalidatePath("/broadcasts");
  redirect(`/broadcasts/${id}`);
}

export async function updateBroadcastAction(
  id: string,
  _prev: BroadcastFormState,
  form: FormData,
): Promise<BroadcastFormState> {
  const { tenant } = await requireTenant();
  const parsed = parse(form);
  if (!parsed.ok) return { error: parsed.message };

  const ok = await updateBroadcast(tenant.id, id, parsed);
  if (!ok) return { error: "This broadcast can no longer be edited (it has been sent)." };

  revalidatePath(`/broadcasts/${id}`);
  redirect(`/broadcasts/${id}`);
}

/** Send: snapshot recipients and queue for the worker. Stays on the detail page. */
export async function sendBroadcastAction(id: string) {
  const { tenant } = await requireTenant();
  await queueBroadcast(tenant.id, id);
  revalidatePath(`/broadcasts/${id}`);
  revalidatePath("/broadcasts");
  redirect(`/broadcasts/${id}`);
}

export async function cancelBroadcastAction(id: string) {
  const { tenant } = await requireTenant();
  await cancelBroadcast(tenant.id, id);
  revalidatePath(`/broadcasts/${id}`);
  revalidatePath("/broadcasts");
}

export async function deleteBroadcastAction(id: string) {
  const { tenant } = await requireTenant();
  await deleteBroadcast(tenant.id, id);
  revalidatePath("/broadcasts");
  redirect("/broadcasts");
}
