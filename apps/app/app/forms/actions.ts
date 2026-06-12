"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createLeadForm,
  setLeadFormStatus,
  type LeadFormStatus,
} from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "form"
  );
}

export async function createLeadFormAction(form: FormData): Promise<void> {
  const { tenant } = await requireTenant();

  const title = String(form.get("title") ?? "").trim();
  if (!title) redirect("/forms/new?error=title");

  const input = {
    title,
    description: String(form.get("description") ?? "").trim() || null,
    buttonLabel: String(form.get("buttonLabel") ?? "").trim() || "Submit",
    successMessage: String(form.get("successMessage") ?? "").trim() || null,
    collectPhone: form.get("collectPhone") === "on",
    collectMessage: form.get("collectMessage") === "on",
  };
  const publish = form.get("publish") === "on";

  // Auto-slug from the title; on clash, suffix -2, -3 … so the seller never has
  // to think about the public link.
  const base = slugify(title);
  let created: { ok: true; id: string } | null = null;
  for (let i = 0; i < 6 && !created; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const r = await createLeadForm(tenant.id, slug, input);
    if (r.ok) created = r;
  }
  if (!created) redirect("/forms/new?error=slug");

  if (publish) await setLeadFormStatus(tenant.id, created.id, "PUBLISHED");
  revalidatePath("/forms");
  redirect(`/forms/${created.id}`);
}

export async function setLeadFormStatusAction(
  id: string,
  status: LeadFormStatus,
): Promise<void> {
  const { tenant } = await requireTenant();
  await setLeadFormStatus(tenant.id, id, status);
  revalidatePath("/forms");
  revalidatePath(`/forms/${id}`);
}
