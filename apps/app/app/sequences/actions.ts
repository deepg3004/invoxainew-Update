"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createSequence,
  updateSequence,
  setSequenceActive,
  deleteSequence,
  addStep,
  deleteStep,
  type SequenceTrigger,
} from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";

export type SequenceFormState = { error?: string };

const TRIGGERS: SequenceTrigger[] = ["PURCHASE", "LEAD", "MANUAL"];
const ID_RE = /^[0-9a-f-]{36}$/i;

function parseSequence(
  form: FormData,
): { ok: true; name: string; trigger: SequenceTrigger; triggerProductId: string | null } | {
  ok: false;
  message: string;
} {
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return { ok: false, message: "Name must be 2–80 characters." };
  }
  const triggerRaw = String(form.get("trigger") ?? "");
  const trigger = TRIGGERS.includes(triggerRaw as SequenceTrigger)
    ? (triggerRaw as SequenceTrigger)
    : "MANUAL";

  let triggerProductId: string | null = null;
  if (trigger === "PURCHASE") {
    const raw = String(form.get("triggerProductId") ?? "").trim();
    if (raw) {
      if (!ID_RE.test(raw)) return { ok: false, message: "Trigger product is invalid." };
      triggerProductId = raw;
    }
  }
  return { ok: true, name, trigger, triggerProductId };
}

export async function createSequenceAction(
  _prev: SequenceFormState,
  form: FormData,
): Promise<SequenceFormState> {
  const { tenant } = await requireTenant();
  const parsed = parseSequence(form);
  if (!parsed.ok) return { error: parsed.message };

  const result = await createSequence(tenant.id, {
    name: parsed.name,
    trigger: parsed.trigger,
    triggerProductId: parsed.triggerProductId,
  });
  if (!result.ok) return { error: "That trigger product no longer exists or isn't yours." };

  revalidatePath("/sequences");
  redirect(`/sequences/${result.id}`);
}

export async function updateSequenceAction(
  id: string,
  _prev: SequenceFormState,
  form: FormData,
): Promise<SequenceFormState> {
  const { tenant } = await requireTenant();
  const parsed = parseSequence(form);
  if (!parsed.ok) return { error: parsed.message };

  const result = await updateSequence(tenant.id, id, {
    name: parsed.name,
    trigger: parsed.trigger,
    triggerProductId: parsed.triggerProductId,
  });
  if (!result.ok) return { error: "Could not save the sequence." };

  revalidatePath(`/sequences/${id}`);
  redirect("/sequences");
}

export async function setSequenceActiveAction(id: string, active: boolean) {
  const { tenant } = await requireTenant();
  await setSequenceActive(tenant.id, id, active);
  revalidatePath("/sequences");
}

export async function deleteSequenceAction(id: string) {
  const { tenant } = await requireTenant();
  await deleteSequence(tenant.id, id);
  revalidatePath("/sequences");
  redirect("/sequences");
}

export async function addStepAction(
  sequenceId: string,
  _prev: SequenceFormState,
  form: FormData,
): Promise<SequenceFormState> {
  const { tenant } = await requireTenant();

  const delayRaw = String(form.get("delayHours") ?? "").trim();
  const delayHours = Number(delayRaw);
  if (!Number.isInteger(delayHours) || delayHours < 0 || delayHours > 8760) {
    return { error: "Delay must be a whole number of hours (0–8760)." };
  }
  const subject = String(form.get("subject") ?? "").trim() || null;
  const body = String(form.get("body") ?? "").trim();
  if (body.length < 2 || body.length > 5000) {
    return { error: "Message body must be 2–5000 characters." };
  }

  const result = await addStep(tenant.id, sequenceId, { delayHours, subject, body });
  if (!result.ok) return { error: "Could not add the step." };

  revalidatePath(`/sequences/${sequenceId}`);
  return {};
}

export async function deleteStepAction(sequenceId: string, stepId: string) {
  const { tenant } = await requireTenant();
  await deleteStep(tenant.id, stepId);
  revalidatePath(`/sequences/${sequenceId}`);
}
