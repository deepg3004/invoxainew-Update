"use server";

import { headers } from "next/headers";
import { createProductReview, notifyTenant } from "@invoxai/db";
import { resolveTenantByHost } from "../lib/resolve";
import { getSessionUser } from "../lib/auth";
import type { SubmitReviewResult } from "../lib/reviews";

/**
 * A buyer submits (or edits) a star review for a product. Tenant is host-resolved
 * and the reviewer is the signed-in user; createProductReview re-verifies the
 * purchase server-side, so only an actual buyer of the product can review it.
 */
export async function submitProductReview(input: {
  productId: string;
  productTitle: string;
  rating: number;
  body: string;
  authorName: string;
}): Promise<SubmitReviewResult> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in to leave a review." };

  const res = await createProductReview({
    tenantId: tenant.id,
    productId: input.productId,
    buyerProfileId: user.id,
    buyerEmail: user.email ?? null,
    rating: input.rating,
    body: input.body,
    authorName: input.authorName,
  });
  if (!res.ok) {
    return {
      ok: false,
      error:
        res.reason === "not_purchased"
          ? "You can only review a product you’ve purchased."
          : "Please choose a rating from 1 to 5 stars.",
    };
  }

  // Notify the seller on a NEW review only (not on edits). Best-effort.
  if (res.isNew) {
    const rating = Math.max(1, Math.min(5, Math.round(input.rating)));
    await notifyTenant(tenant.id, {
      type: "new_review",
      title: "New review",
      body: `${"★".repeat(rating)} on ${input.productTitle || "a product"}`,
      link: "/reviews",
    }).catch(() => {});
  }
  return { ok: true };
}
