"use server";

import { revalidatePath } from "next/cache";
import { upsertPricingSetting } from "@invoxai/db";
import { rupeeStringToPaise } from "@invoxai/utils/money";
import { requireAdmin } from "../../lib/auth";

export type PricingFormState = { error?: string; ok?: boolean };

const KEY_RE = /^[a-z0-9](?:[a-z0-9_-]{1,48}[a-z0-9])?$/;

/**
 * Create-or-update a pricing knob. Used by both the per-row editors (key/label
 * fixed, value changes) and the "add setting" form (all fields). Upsert by key
 * makes it idempotent either way.
 */
export async function savePricingSettingAction(
  _prev: PricingFormState,
  form: FormData,
): Promise<PricingFormState> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: "Not authorized." };

  const key = String(form.get("key") ?? "").trim().toLowerCase();
  if (!KEY_RE.test(key)) {
    return { error: "Key must be 2–50 chars: lowercase letters, digits, - or _." };
  }

  const label = String(form.get("label") ?? "").trim();
  if (!label) return { error: "Label is required." };

  const value = rupeeStringToPaise(String(form.get("value") ?? ""));
  if (!value.ok) return { error: `Amount: ${value.message}` };

  await upsertPricingSetting({ key, label, valuePaise: value.paise });
  revalidatePath("/pricing");
  return { ok: true };
}
