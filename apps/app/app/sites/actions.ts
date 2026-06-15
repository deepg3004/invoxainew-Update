"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSite, renameSite, deleteSite, assignPageToSite } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";

export type SiteFormState = { error?: string };

const ID_RE = /^[0-9a-f-]{36}$/i;

export async function createSiteAction(
  _prev: SiteFormState,
  form: FormData,
): Promise<SiteFormState> {
  const { tenant } = await requireTenant();
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) return { error: "Name must be 2–80 characters." };
  const id = await createSite(tenant.id, name);
  revalidatePath("/sites");
  redirect(`/sites/${id}`);
}

export async function renameSiteAction(
  siteId: string,
  _prev: SiteFormState,
  form: FormData,
): Promise<SiteFormState> {
  const { tenant } = await requireTenant();
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) return { error: "Name must be 2–80 characters." };
  await renameSite(tenant.id, siteId, name);
  revalidatePath(`/sites/${siteId}`);
  return {};
}

export async function deleteSiteAction(siteId: string) {
  const { tenant } = await requireTenant();
  await deleteSite(tenant.id, siteId);
  revalidatePath("/sites");
  redirect("/sites");
}

/** Add an existing page to this site (from the picker). */
export async function addPageToSiteAction(siteId: string, form: FormData) {
  const { tenant } = await requireTenant();
  const pageId = String(form.get("pageId") ?? "").trim();
  if (!ID_RE.test(pageId)) return;
  await assignPageToSite(tenant.id, pageId, { siteId });
  revalidatePath(`/sites/${siteId}`);
}

/** Save a page's nav label + order within this site. */
export async function savePageNavAction(siteId: string, pageId: string, form: FormData) {
  const { tenant } = await requireTenant();
  const navLabel = String(form.get("navLabel") ?? "").trim().slice(0, 60) || null;
  const orderRaw = String(form.get("navOrder") ?? "0").trim();
  const n = Number(orderRaw);
  const navOrder = Number.isInteger(n) && n >= 0 && n <= 999 ? n : 0;
  await assignPageToSite(tenant.id, pageId, { siteId, navLabel, navOrder });
  revalidatePath(`/sites/${siteId}`);
}

/** Detach a page from its site (it becomes standalone again). */
export async function removePageFromSiteAction(siteId: string, pageId: string) {
  const { tenant } = await requireTenant();
  await assignPageToSite(tenant.id, pageId, { siteId: null });
  revalidatePath(`/sites/${siteId}`);
}
