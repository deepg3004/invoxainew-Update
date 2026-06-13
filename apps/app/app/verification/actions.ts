"use server";

import { revalidatePath } from "next/cache";
import { submitVerification } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";

export type VerificationFormState = { error?: string; ok?: boolean };

/** Seller submits business details for verification → PENDING. */
export async function submitVerificationAction(
  _prev: VerificationFormState,
  form: FormData,
): Promise<VerificationFormState> {
  const { tenant } = await requireTenant();

  const legalName = String(form.get("legalName") ?? "").trim();
  const details = String(form.get("details") ?? "").trim();
  if (!legalName) return { error: "Enter your business / legal name." };

  const note = `Legal/business name: ${legalName}${details ? `\n\n${details}` : ""}`;
  const res = await submitVerification(tenant.id, note);
  if (res.count === 0) {
    return { error: "You can't submit right now — you may already be verified or under review." };
  }
  revalidatePath("/verification");
  return { ok: true };
}
