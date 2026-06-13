"use server";

import { revalidatePath } from "next/cache";
import { setStoreAnnouncement, logActivity } from "@invoxai/db";
import { safeUrl } from "@invoxai/utils/blocks";
import { requireTenant } from "../../lib/tenant";

export type StorefrontFormState = { error?: string; ok?: boolean };

/** Save (or clear) the storefront announcement bar. Owner-scoped via requireTenant. */
export async function saveStorefrontAction(
  _prev: StorefrontFormState,
  form: FormData,
): Promise<StorefrontFormState> {
  const { tenant } = await requireTenant();

  const announcement = String(form.get("announcement") ?? "").trim().slice(0, 200) || null;

  const linkRaw = String(form.get("announcementLink") ?? "").trim();
  let announcementLink: string | null = null;
  if (linkRaw) {
    const safe = safeUrl(linkRaw);
    if (!safe) return { error: "Link must be a valid http(s) URL or a /path (or leave it blank)." };
    announcementLink = safe;
  }

  await setStoreAnnouncement(tenant.id, {
    announcement,
    // A link with no message would never render; drop it.
    announcementLink: announcement ? announcementLink : null,
  });
  await logActivity(
    tenant.id,
    announcement ? "storefront.announcement_set" : "storefront.announcement_cleared",
  ).catch(() => {});
  revalidatePath("/storefront");
  return { ok: true };
}
