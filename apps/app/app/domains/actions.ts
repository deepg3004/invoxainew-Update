"use server";

import { resolveTxt } from "node:dns/promises";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  addDomain,
  getDomainById,
  deleteDomain,
  markDomainVerified,
  planAllowsCustomDomain,
} from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";

export type DomainFormState = { error?: string };

export async function addDomainAction(
  _prev: DomainFormState,
  form: FormData,
): Promise<DomainFormState> {
  const { tenant } = await requireTenant();

  // Premium feature: gate on the seller's plan (defence-in-depth — the UI also
  // hides the form when not allowed).
  if (!(await planAllowsCustomDomain(tenant.id))) {
    return { error: "Custom domains aren’t included on your plan. Upgrade to connect one." };
  }

  const raw = String(form.get("domain") ?? "");
  const result = await addDomain(tenant.id, raw);
  if (!result.ok) {
    return {
      error:
        result.reason === "already_added"
          ? "You've already added that domain."
          : "Enter a valid domain like shop.example.com (not an invoxai.io address).",
    };
  }
  revalidatePath("/domains");
  redirect("/domains");
}

/**
 * Verify DNS control by checking the TXT challenge record, then flip the domain
 * to VERIFIED. Redirects back with a ?msg= so the page can show the outcome.
 */
export async function verifyDomainAction(id: string) {
  const { tenant } = await requireTenant();
  const domain = await getDomainById(tenant.id, id);
  if (!domain) redirect("/domains");
  if (domain.status === "VERIFIED") redirect("/domains?msg=verified");

  let records: string[][] = [];
  try {
    records = await resolveTxt(`_invoxai-challenge.${domain.domain}`);
  } catch {
    // NXDOMAIN / no record yet — treated as not-found below.
  }
  const found = records.flat().map((s) => s.trim()).includes(domain.verifyToken);
  if (!found) redirect("/domains?msg=txt_missing");

  const res = await markDomainVerified(tenant.id, id);
  revalidatePath("/domains");
  if (!res.ok && res.reason === "conflict") redirect("/domains?msg=conflict");
  redirect("/domains?msg=verified");
}

export async function deleteDomainAction(id: string) {
  const { tenant } = await requireTenant();
  await deleteDomain(tenant.id, id);
  revalidatePath("/domains");
}
