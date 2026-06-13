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
  | { ok: true; reviewId: string; isNew: boolean }
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

  const key = {
    productId_buyerProfileId: {
      productId: input.productId,
      buyerProfileId: input.buyerProfileId,
    },
  };
  const existing = await prisma.productReview.findUnique({ where: key, select: { id: true } });
  const review = await prisma.productReview.upsert({
    where: key,
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
  return { ok: true, reviewId: review.id, isNew: existing === null };
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
  const map = new Map<string, RatingSummary>();
  for (const r of rows) {
    if (r.productId) map.set(r.productId, { count: r._count._all, avg: r._avg.rating ?? 0 });
  }
  return map;
}

/** All of a seller's reviews (product + course) for moderation, newest first. Scoped. */
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
      product: { select: { title: true } },
      course: { select: { title: true } },
    },
  });
}

/** Hide/show a review (seller moderation). Tenant-scoped, so a forged id can't
 *  touch another seller's reviews. Works for product AND course reviews. */
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

// ── Course reviews (verified by enrolment) ────────────────────────────────────

/** Is this buyer enrolled in the course? (verified for a course review) */
async function hasEnrolled(
  tenantId: string,
  courseId: string,
  profileId: string,
  email: string | null,
): Promise<boolean> {
  const attribution: object[] = [{ buyerProfileId: profileId }];
  if (email) attribution.push({ buyerEmail: email });
  const enrolment = await prisma.enrolment.findFirst({
    where: { tenantId, courseId, OR: attribution },
    select: { id: true },
  });
  return enrolment !== null;
}

/**
 * Create or update this buyer's review of a course. Verifies ENROLMENT server-side
 * (the course equivalent of a verified purchase — enrolment is granted on PAID),
 * so only an enrolled learner can review. Editing keeps the moderation status.
 */
export async function createCourseReview(input: {
  tenantId: string;
  courseId: string;
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
  const enrolled = await hasEnrolled(
    input.tenantId,
    input.courseId,
    input.buyerProfileId,
    input.buyerEmail ?? null,
  );
  if (!enrolled) return { ok: false, reason: "not_purchased" };

  const body = (input.body ?? "").trim().slice(0, 2000) || null;
  const authorName = (input.authorName ?? "").trim().slice(0, 80) || null;
  const key = {
    courseId_buyerProfileId: {
      courseId: input.courseId,
      buyerProfileId: input.buyerProfileId,
    },
  };
  const existing = await prisma.productReview.findUnique({ where: key, select: { id: true } });
  const review = await prisma.productReview.upsert({
    where: key,
    create: {
      tenantId: input.tenantId,
      courseId: input.courseId,
      buyerProfileId: input.buyerProfileId,
      rating,
      body,
      authorName,
    },
    update: { rating, body, authorName },
    select: { id: true },
  });
  return { ok: true, reviewId: review.id, isNew: existing === null };
}

/** This buyer's existing review of a course (to prefill the form), or null. */
export function getBuyerReviewForCourse(courseId: string, buyerProfileId: string) {
  return prisma.productReview.findUnique({
    where: { courseId_buyerProfileId: { courseId, buyerProfileId } },
    select: { rating: true, body: true, authorName: true, status: true },
  });
}

/** Published reviews for a course, newest first (public course page). */
export function getCourseReviews(courseId: string, take = 50) {
  return prisma.productReview.findMany({
    where: { courseId, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, rating: true, body: true, authorName: true, createdAt: true },
  });
}

/** Average rating + count for a course (PUBLISHED only). */
export async function getCourseRatingSummary(courseId: string): Promise<RatingSummary> {
  const agg = await prisma.productReview.aggregate({
    where: { courseId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return { count: agg._count._all, avg: agg._avg.rating ?? 0 };
}
