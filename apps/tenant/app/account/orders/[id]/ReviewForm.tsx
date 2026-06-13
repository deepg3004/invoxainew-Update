"use client";

import { useState } from "react";
import { submitProductReview } from "../../../review-actions";

/**
 * Verified-purchase review form for one product on the buyer's order receipt.
 * Prefilled when they've already reviewed it (editing keeps the review's
 * moderation status server-side). The order page only renders this for products
 * in this buyer's own PAID order, and the action re-verifies the purchase.
 */
export function ReviewForm({
  productId,
  productTitle,
  initial,
}: {
  productId: string;
  productTitle: string;
  initial: { rating: number; body: string | null; authorName: string | null } | null;
}) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState(initial?.body ?? "");
  const [authorName, setAuthorName] = useState(initial?.authorName ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (rating < 1) {
      setError("Tap a star to rate.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await submitProductReview({
        productId,
        rating,
        body: body.trim(),
        authorName: authorName.trim(),
      });
      if (res.ok) setSaved(true);
      else setError(res.error);
    } catch {
      setError("Couldn’t save your review. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <p className="text-sm font-medium text-green-700">
        Thanks for reviewing {productTitle}! ✓
      </p>
    );
  }

  const shown = hover || rating;

  return (
    <div>
      <p className="text-sm font-medium text-zinc-900">{productTitle}</p>
      <div className="mt-1 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className={`text-2xl leading-none ${n <= shown ? "text-amber-500" : "text-zinc-300"}`}
          >
            ★
          </button>
        ))}
        {initial ? <span className="ml-2 text-xs text-muted">(editing your review)</span> : null}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share what you liked (optional)"
        rows={2}
        className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
      />
      <input
        value={authorName}
        onChange={(e) => setAuthorName(e.target.value)}
        placeholder="Display name (optional)"
        className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
      />
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      <button
        onClick={submit}
        disabled={saving}
        className="mt-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : initial ? "Update review" : "Submit review"}
      </button>
    </div>
  );
}
