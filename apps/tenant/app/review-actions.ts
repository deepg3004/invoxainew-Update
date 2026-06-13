"use server";

import { headers } from "next/headers";
import { createProductReview, createCourseReview, notifyTenant } from "@invoxai/db";
import { resolveTenantByHost } from "../lib/resolve";
import { getSessionUser } from "../lib/auth";
import type { SubmitReviewResult } from "../lib/reviews";

/**
 * A buyer submits (or edits) a star review for a PRODUCT or a COURSE. Tenant is
 * host-resolved and the reviewer is the signed-in user; the DB layer re-verifies
 * eligibility server-side — a paid order for a product, an enrolment for a course —
 * so only a real buyer/learner can review. Notifies the seller on a new review.
 */
export async function submitReview(input: {
  kind: "product" | "course";
  subjectId: string;
  subjectTitle: string;
  rating: number;
  body: string;
  authorName: string;
}): Promise<SubmitReviewResult> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in to leave a review." };

  const common = {
    tenantId: tenant.id,
    buyerProfileId: user.id,
    buyerEmail: user.email ?? null,
    rating: input.rating,
    body: input.body,
    authorName: input.authorName,
  };
  const res =
    input.kind === "course"
      ? await createCourseReview({ ...common, courseId: input.subjectId })
      : await createProductReview({ ...common, productId: input.subjectId });

  if (!res.ok) {
    if (res.reason === "not_purchased") {
      return {
        ok: false,
        error:
          input.kind === "course"
            ? "You can only review a course you’re enrolled in."
            : "You can only review a product you’ve purchased.",
      };
    }
    return { ok: false, error: "Please choose a rating from 1 to 5 stars." };
  }

  // Notify the seller on a NEW review only (not edits). Best-effort.
  if (res.isNew) {
    const rating = Math.max(1, Math.min(5, Math.round(input.rating)));
    await notifyTenant(tenant.id, {
      type: "new_review",
      title: "New review",
      body: `${"★".repeat(rating)} on ${input.subjectTitle || (input.kind === "course" ? "a course" : "a product")}`,
      link: "/reviews",
    }).catch(() => {});
  }
  return { ok: true };
}
