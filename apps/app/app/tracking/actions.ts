"use server";

import { revalidatePath } from "next/cache";
import { upsertTenantTracking } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";

const clean = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

/** Save the seller's tracking IDs (tenant-scoped). */
export async function saveTrackingAction(form: FormData) {
  const { tenant } = await requireTenant();
  await upsertTenantTracking({
    tenantId: tenant.id,
    metaPixelId: clean(form.get("metaPixelId")),
    ga4MeasurementId: clean(form.get("ga4MeasurementId")),
    googleAdsId: clean(form.get("googleAdsId")),
    gtmId: clean(form.get("gtmId")),
    tiktokPixelId: clean(form.get("tiktokPixelId")),
    // Unchecked checkboxes are absent from FormData → false.
    socialProofEnabled: form.get("socialProofEnabled") === "on",
  });
  revalidatePath("/tracking");
}
