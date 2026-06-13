import { prisma } from "./client";

/**
 * Verified-purchase product reviews.
 *
 * A review can only be written by a buyer who has a PAID order containing the
 * product (checked in createProductReview), one per buyer per product. Public
 * reads return PUBLISHED reviews only; the seller can HIDE a review to moderate.
 * Everything is tenant-scoped.
 */

export type CreateReviewResult =
  | { ok: true; reviewId: string }
  | { ok: false; reason: "invalid" | "not_purchased" };

/** Does this buyer have a PAID order containing this product? (verified purchase) */
async function hasPurchased(
  tenantId: string,
  productId: string,
  profileId: string,
  email: string | null,
): Promise<boolean> {
  const attribution: object[] = [{ buyerProfileId: profileId }];
  if (email) attribution.push({ buyerEmail: email });
  const order = await prisma.buyerPayment.findFirst({
    where: {
      tenantId,
      status: "PAID",
      OR: attribution,
      // The product is the single-product order OR one of the cart line items.
      AND: [{ OR: [{ productId }, { orderItems: { some: { productId } } }] }],
    },
    select: { id: true },
  });
  return order !== null;
}

/**
 * Create or update this buyer's review of a product. SECURITY: re-verifies the
 * purchase server-side (never trusts the caller), so only someone who actually
 * paid for the product can review it. Editing keeps the current moderation status
 * (a HIDDEN review stays hidden), so an edit can't undo seller moderation.
 */
export async function createProductReview(input: {
  tenantId: string;
  productId: string;
  buyerProfileId: string;
  buyerEmail?: string | null;
  rating: number;
  body?: string | null;
  authorName?: string | null;
}): Promise<CreateReviewResult> {
  const rating = Math.round(Number(input.rating));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, reason: "invalid" };
  }
  const purchased = await hasPurchased(
    input.tenantId,
    input.productId,
    input.buyerProfileId,
    input.buyerEmail ?? null,
  );
  if (!purchased) return { ok: false, reason: "not_purchased" };

  const body = (input.body ?? "").trim().slice(0, 2000) || null;
  const authorName = (input.authorName ?? "").trim().slice(0, 80) || null;

  const review = await prisma.productReview.upsert({
    where: {
      productId_buyerProfileId: {
        productId: input.productId,
        buyerProfileId: input.buyerProfileId,
      },
    },
    create: {
      tenantId: input.tenantId,
      productId: input.productId,
      buyerProfileId: input.buyerProfileId,
      rating,
      body,
      authorName,
    },
    update: { rating, body, authorName }, // status intentionally untouched
    select: { id: true },
  });
  return { ok: true, reviewId: review.id };
}

/** This buyer's existing review of a product (to prefill the form), or null. */
export function getBuyerReviewForProduct(productId: string, buyerProfileId: string) {
  return prisma.productReview.findUnique({
    where: { productId_buyerProfileId: { productId, buyerProfileId } },
    select: { rating: true, body: true, authorName: true, status: true },
  });
}

/** Published reviews for a product, newest first (public product page). */
export function getProductReviews(productId: string, take = 50) {
  return prisma.productReview.findMany({
    where: { productId, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, rating: true, body: true, authorName: true, createdAt: true },
  });
}

export type RatingSummary = { count: number; avg: number };

/** Average rating + count for a product (PUBLISHED only). */
export async function getProductRatingSummary(productId: string): Promise<RatingSummary> {
  const agg = await prisma.productReview.aggregate({
    where: { productId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return { count: agg._count._all, avg: agg._avg.rating ?? 0 };
}

/** Batched rating summaries for many products (store listing cards). */
export async function getProductRatingSummaries(
  productIds: string[],
): Promise<Map<string, RatingSummary>> {
  if (productIds.length === 0) return new Map();
  const rows = await prisma.productReview.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds }, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map(
    rows.map((r) => [r.productId, { count: r._count._all, avg: r._avg.rating ?? 0 }]),
  );
}

/** All of a seller's reviews (for moderation), newest first. Tenant-scoped. */
export function listTenantReviews(tenantId: string, take = 200) {
  return prisma.productReview.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      rating: true,
      body: true,
      authorName: true,
      status: true,
      createdAt: true,
      product: { select: { title: true, slug: true } },
    },
  });
}

/** Hide/show a review (seller moderation). Tenant-scoped, so a forged id can't
 *  touch another seller's reviews. */
export function setReviewStatus(
  tenantId: string,
  reviewId: string,
  status: "PUBLISHED" | "HIDDEN",
) {
  return prisma.productReview.updateMany({
    where: { id: reviewId, tenantId },
    data: { status },
  });
}
