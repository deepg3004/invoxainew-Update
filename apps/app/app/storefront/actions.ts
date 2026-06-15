"use server";

import { revalidatePath } from "next/cache";
import { setStoreAnnouncement, setStorefrontBranding, logActivity } from "@invoxai/db";
import { safeUrl, THEME_PRESETS } from "@invoxai/utils/blocks";
import { requireTenant } from "../../lib/tenant";

export type StorefrontFormState = { error?: string; ok?: boolean };

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Save the storefront branding (logo/banner/colour/about/footer/SEO). All URLs
 *  pass safeUrl; the brand colour must be a hex value; text is trimmed + capped. */
export async function saveBrandingAction(
  _prev: StorefrontFormState,
  form: FormData,
): Promise<StorefrontFormState> {
  const { tenant } = await requireTenant();
  const url = (k: string) => {
    const raw = String(form.get(k) ?? "").trim();
    return raw ? safeUrl(raw) || null : null;
  };
  const text = (k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max) || null;
  const colorRaw = String(form.get("brandColor") ?? "").trim();
  const themeRaw = String(form.get("storeTheme") ?? "").trim();
  const storeTheme = themeRaw && themeRaw in THEME_PRESETS ? themeRaw : null;

  await setStorefrontBranding(tenant.id, {
    logoUrl: url("logoUrl"),
    bannerUrl: url("bannerUrl"),
    brandColor: HEX_RE.test(colorRaw) ? colorRaw : null,
    aboutText: text("aboutText", 1000),
    privacyUrl: url("privacyUrl"),
    refundUrl: url("refundUrl"),
    termsUrl: url("termsUrl"),
    storeMetaTitle: text("storeMetaTitle", 200),
    storeMetaDescription: text("storeMetaDescription", 300),
    storeTheme,
  });
  await logActivity(tenant.id, "storefront.branding_updated").catch(() => {});
  revalidatePath("/storefront");
  return { ok: true };
}

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
