/** Result of submitting a product review (the submitProductReview server action). */
export type SubmitReviewResult = { ok: true } | { ok: false; error: string };
