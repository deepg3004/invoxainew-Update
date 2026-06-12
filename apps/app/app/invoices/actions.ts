"use server";

import { revalidatePath } from "next/cache";
import { isGstStateCode } from "@invoxai/utils/states";
import { setTenantStateCode } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";

/** Save the seller's GST state (place of supply). Tenant-scoped via the session. */
export async function saveTenantStateAction(formData: FormData) {
  const { tenant } = await requireTenant();
  const raw = String(formData.get("stateCode") ?? "").trim();
  await setTenantStateCode(tenant.id, isGstStateCode(raw) ? raw : null);
  revalidatePath("/invoices");
}
