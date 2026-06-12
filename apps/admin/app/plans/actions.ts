"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createPlan, updatePlan, setPlanActive } from "@invoxai/db";
import { rupeeStringToPaise, percentStringToBps } from "@invoxai/utils/money";
import { requireAdmin } from "../../lib/auth";

export type PlanFormState = { error?: string };

const KEY_RE = /^[a-z0-9](?:[a-z0-9_-]{1,38}[a-z0-9])?$/;

/** Parse a blank-or-non-negative-integer limit field. Blank → null (unlimited). */
function parseLimit(
  raw: string,
  fieldLabel: string,
): { ok: true; value: number | null } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) {
    return { ok: false, message: `${fieldLabel} must be a whole number (or blank for unlimited).` };
  }
  return { ok: true, value: n };
}

/** Shared parse of the editable plan fields (everything except `key`). */
function parseEditableFields(form: FormData):
  | {
      ok: true;
      data: {
        name: string;
        description: string | null;
        priceMonthly: number;
        priceYearly: number;
        commissionBps: number;
        maxProducts: number | null;
        maxAiPages: number | null;
        customDomainAllowed: boolean;
        sortOrder: number;
      };
    }
  | { ok: false; message: string } {
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Name is required." };

  const monthly = rupeeStringToPaise(String(form.get("priceMonthly") ?? ""));
  if (!monthly.ok) return { ok: false, message: `Monthly price: ${monthly.message}` };

  const yearly = rupeeStringToPaise(String(form.get("priceYearly") ?? ""));
  if (!yearly.ok) return { ok: false, message: `Yearly price: ${yearly.message}` };

  const commission = percentStringToBps(String(form.get("commission") ?? ""));
  if (!commission.ok) return { ok: false, message: `Commission: ${commission.message}` };

  const maxProducts = parseLimit(String(form.get("maxProducts") ?? ""), "Max products");
  if (!maxProducts.ok) return { ok: false, message: maxProducts.message };

  const maxAiPages = parseLimit(String(form.get("maxAiPages") ?? ""), "Max AI pages");
  if (!maxAiPages.ok) return { ok: false, message: maxAiPages.message };

  const sortRaw = String(form.get("sortOrder") ?? "0").trim() || "0";
  const sortOrder = Number(sortRaw);
  if (!Number.isInteger(sortOrder)) {
    return { ok: false, message: "Sort order must be a whole number." };
  }

  const description = String(form.get("description") ?? "").trim() || null;

  return {
    ok: true,
    data: {
      name,
      description,
      priceMonthly: monthly.paise,
      priceYearly: yearly.paise,
      commissionBps: commission.bps,
      maxProducts: maxProducts.value,
      maxAiPages: maxAiPages.value,
      customDomainAllowed: form.get("customDomainAllowed") === "on",
      sortOrder,
    },
  };
}

export async function createPlanAction(
  _prev: PlanFormState,
  form: FormData,
): Promise<PlanFormState> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: "Not authorized." };

  const key = String(form.get("key") ?? "").trim().toLowerCase();
  if (!KEY_RE.test(key)) {
    return {
      error: "Key must be 2–40 chars: lowercase letters, digits, - or _.",
    };
  }

  const parsed = parseEditableFields(form);
  if (!parsed.ok) return { error: parsed.message };

  const result = await createPlan({ key, ...parsed.data });
  if (!result.ok) return { error: `The key "${key}" is already in use.` };

  revalidatePath("/plans");
  redirect("/plans");
}

export async function updatePlanAction(
  id: string,
  _prev: PlanFormState,
  form: FormData,
): Promise<PlanFormState> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: "Not authorized." };

  const parsed = parseEditableFields(form);
  if (!parsed.ok) return { error: parsed.message };

  await updatePlan(id, parsed.data);
  revalidatePath("/plans");
  redirect("/plans");
}

/** Retire / restore a plan (soft enable-disable). */
export async function setPlanActiveAction(id: string, isActive: boolean) {
  const gate = await requireAdmin();
  if (!gate.ok) return;
  await setPlanActive(id, isActive);
  revalidatePath("/plans");
}
