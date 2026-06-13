"use server";

import { revalidatePath } from "next/cache";
import { setReviewStatus, logActivity } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";

/**
 * Hide or show a product review (seller moderation). Tenant-scoped in the DB
 * layer, so a forged id can't touch another seller's reviews. Hidden reviews
 * drop off the public product page and out of the rating average.
 */
export async function setReviewStatusAction(
  id: string,
  status: "PUBLISHED" | "HIDDEN",
): Promise<void> {
  const { tenant } = await requireTenant();
  await setReviewStatus(tenant.id, id, status);
  await logActivity(tenant.id, status === "HIDDEN" ? "review.hidden" : "review.shown").catch(
    () => {},
  );
  revalidatePath("/reviews");
}
