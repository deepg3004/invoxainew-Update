"use client";

import { useState } from "react";
import { formatRupees } from "@invoxai/utils/money";

export type SubmitUpiResult = { ok: true } | { ok: false; error: string };

/**
 * The post-submit "pending confirmation" card, shared by every manual-UPI
 * checkout surface (pay page, product, course, cart). Deliberately NOT a success
 * state — the buyer paid the seller's UPI directly and the seller still has to
 * verify it, so the copy is "submitted / awaiting confirmation", never "paid".
 */
export function UpiSubmitted() {
  return (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-6 text-center">
      <p className="font-display text-lg font-semibold text-zinc-900">Payment submitted</p>
      <p className="mt-1 text-sm text-amber-800">
        The seller will verify your UPI payment and confirm your order shortly. It’ll appear in
        your orders once confirmed.
      </p>
      <a
        href="/account"
        className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white"
      >
        Go to your orders
      </a>
    </div>
  );
}

/**
 * The manual-UPI pay flow: show the seller's UPI ID + a prefilled `upi://` deep
 * link + a UTR input, and on "I've paid — submit" call `onSubmit(upiRef)` (the
 * caller's server action that records a PENDING order). On success it calls
 * `onSubmitted()` so the parent can collapse to <UpiSubmitted/> (and e.g. clear
 * the cart) — this panel does NOT render the success state itself.
 *
 * SECURITY: `amountPaise` is only the buyer-convenience deep-link amount. The
 * authoritative charged amount is re-priced server-side inside the caller's
 * action, and the SELLER manually verifies the real money received before
 * confirming — so a tampered deep-link amount can never produce a confirmed sale.
 */
export function UpiPayPanel({
  upi,
  amountPaise,
  title,
  onSubmit,
  onSubmitted,
}: {
  upi: { upiId: string; payeeName: string };
  amountPaise: number;
  title: string;
  onSubmit: (upiRef: string) => Promise<SubmitUpiResult>;
  onSubmitted: () => void;
}) {
  const [upiRef, setUpiRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upiLink = `upi://pay?pa=${encodeURIComponent(upi.upiId)}&pn=${encodeURIComponent(
    upi.payeeName,
  )}&am=${(amountPaise / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(title)}`;

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await onSubmit(upiRef.trim());
      if (res.ok) {
        onSubmitted();
      } else {
        setError(res.error);
        setSubmitting(false);
      }
    } catch {
      setError("Couldn’t submit. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
        <p className="text-muted">
          Pay <span className="font-semibold text-zinc-900">{formatRupees(amountPaise)}</span> to:
        </p>
        <p className="mt-1 font-mono text-base font-semibold text-zinc-900">{upi.upiId}</p>
        <p className="text-xs text-muted">{upi.payeeName}</p>
        <a
          href={upiLink}
          className="mt-2 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
        >
          Open UPI app
        </a>
      </div>
      <input
        value={upiRef}
        onChange={(e) => setUpiRef(e.target.value)}
        placeholder="UPI transaction reference (UTR)"
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
      />
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <button
        onClick={submit}
        disabled={submitting}
        className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "I’ve paid — submit"}
      </button>
      <p className="text-xs text-muted">
        Pay the amount to the UPI ID above in your UPI app, then paste the transaction reference
        (UTR) here. The seller confirms it and your order is finalised.
      </p>
    </div>
  );
}
