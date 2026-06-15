"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createExperiment,
  stopExperiment,
  deleteExperiment,
} from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";

export type ExperimentFormState = { error?: string };

const ID_RE = /^[0-9a-f-]{36}$/i;

export async function createExperimentAction(
  _prev: ExperimentFormState,
  form: FormData,
): Promise<ExperimentFormState> {
  const { tenant } = await requireTenant();

  const paymentPageId = String(form.get("paymentPageId") ?? "").trim();
  if (!ID_RE.test(paymentPageId)) return { error: "Pick a payment page to test." };

  const variantBTitle = String(form.get("variantBTitle") ?? "").trim();
  if (variantBTitle.length < 2 || variantBTitle.length > 200) {
    return { error: "Variant B headline must be 2–200 characters." };
  }
  const desc = String(form.get("variantBDescription") ?? "").trim();
  if (desc.length > 1000) return { error: "Variant B description is too long (max 1000)." };

  const result = await createExperiment(tenant.id, {
    paymentPageId,
    variantBTitle,
    variantBDescription: desc || null,
  });
  if (!result.ok) {
    return {
      error:
        result.reason === "exists"
          ? "That page already has an A/B test. Stop it before starting a new one."
          : "That payment page no longer exists or isn't yours.",
    };
  }

  revalidatePath("/experiments");
  redirect("/experiments");
}

export async function stopExperimentAction(id: string) {
  const { tenant } = await requireTenant();
  await stopExperiment(tenant.id, id);
  revalidatePath("/experiments");
}

export async function deleteExperimentAction(id: string) {
  const { tenant } = await requireTenant();
  await deleteExperiment(tenant.id, id);
  revalidatePath("/experiments");
}
