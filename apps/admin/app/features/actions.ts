"use server";

import { revalidatePath } from "next/cache";
import { listPlans, upsertFeatureRule, setPlanFeatureLimit } from "@invoxai/db";
import { rupeeStringToPaise, percentStringToBps } from "@invoxai/utils/money";
import { requireAdmin } from "../../lib/auth";

const KEY_RE = /^[a-z0-9](?:[a-z0-9_]{1,38}[a-z0-9])?$/;

/** Create or update a feature pricing rule (admin). */
export async function saveFeatureRuleAction(form: FormData) {
  const gate = await requireAdmin();
  if (!gate.ok) return;

  const featureKey = String(form.get("featureKey") ?? "").trim().toLowerCase();
  if (!KEY_RE.test(featureKey)) return;
  const name = String(form.get("name") ?? "").trim() || featureKey;
  const base = rupeeStringToPaise(String(form.get("base") ?? "0"));
  const gst = percentStringToBps(String(form.get("gst") ?? "18"));

  await upsertFeatureRule(
    {
      featureKey,
      name,
      basePaise: base.ok ? base.paise : 0,
      gstRateBps: gst.ok ? gst.bps : 1800,
      walletEnabled: form.get("wallet") === "on",
      directEnabled: form.get("direct") === "on",
      active: form.get("active") === "on",
    },
    gate.user.email!,
  );
  revalidatePath("/features");
}

/** Set the free monthly allowance for a feature across all plans (admin). */
export async function setFeatureLimitsAction(featureKey: string, form: FormData) {
  const gate = await requireAdmin();
  if (!gate.ok) return;

  const plans = await listPlans();
  for (const plan of plans) {
    const raw = String(form.get(`limit_${plan.id}`) ?? "").trim();
    if (raw === "") continue;
    const n = Number(raw);
    if (!Number.isInteger(n)) continue;
    await setPlanFeatureLimit(plan.id, featureKey, n, gate.user.email!);
  }
  revalidatePath("/features");
}
