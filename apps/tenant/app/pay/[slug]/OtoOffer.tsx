"use client";

import { useEffect, useState } from "react";
import { PaymentSuccess } from "@invoxai/ui";
import { formatRupees } from "@invoxai/utils/money";
import { getOtoForOrder, startOtoCheckout } from "./actions";
import { firePurchase } from "../../TrackingScripts";

type Offer = {
  upsellId: string;
  headline: string;
  blurb: string | null;
  offerProductTitle: string;
  listPricePaise: number;
  pricePaise: number;
};

type Phase = "loading" | "offer" | "buying" | "done";

/**
 * Post-purchase one-time offer, shown on the paid screen of a Razorpay checkout.
 * Fetches the seller's active OTO for the just-paid parent order; if there is one,
 * pitches it with a one-click "Add" that charges on the same gateway and confirms
 * through the shared /api/pay/verify. No offer (or after adding) → the normal
 * success card. The amount is server-trusted; this component only passes ids.
 */
export function OtoOffer({ parentOrderId }: { parentOrderId: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getOtoForOrder(parentOrderId);
        if (cancelled) return;
        setOffer(res);
        setPhase(res ? "offer" : "done");
      } catch {
        if (!cancelled) setPhase("done");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parentOrderId]);

  async function addOffer() {
    if (!offer) return;
    setError(null);
    setPhase("buying");
    try {
      const result = await startOtoCheckout(offer.upsellId, parentOrderId);
      if (!result.ok) {
        if (result.alreadyBought) {
          setPhase("done");
          return;
        }
        setError(result.error);
        setPhase("offer");
        return;
      }
      if (!window.Razorpay) {
        setError("Payment library failed to load. Refresh and try again.");
        setPhase("offer");
        return;
      }
      const rzp = new window.Razorpay({
        key: result.keyId,
        order_id: result.orderId,
        amount: result.amountPaise,
        currency: "INR",
        name: result.title,
        handler: async (response: Record<string, string>) => {
          const verify = await fetch("/api/pay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          if (verify.ok) {
            firePurchase(result.amountPaise);
            setPhase("done");
          } else {
            setError("Payment received — confirming. If you were charged, you’re all set.");
            setPhase("offer");
          }
        },
        modal: { ondismiss: () => setPhase("offer") },
      });
      rzp.open();
    } catch {
      setError("Could not start the offer. Please try again.");
      setPhase("offer");
    }
  }

  if (phase === "loading") {
    return (
      <PaymentSuccess
        title="Payment successful"
        subtitle="Thank you! Your payment is confirmed."
        ctaHref="/account"
        ctaLabel="View it in your orders"
      />
    );
  }

  if (phase === "done" || !offer) {
    return (
      <PaymentSuccess
        title="Payment successful"
        subtitle="Thank you! Your payment is confirmed."
        ctaHref="/account"
        ctaLabel="View it in your orders"
      />
    );
  }

  const saved = offer.listPricePaise - offer.pricePaise;

  return (
    <div className="mt-5 rounded-xl border-2 border-brand/40 bg-brand/5 p-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-strong">
        One-time offer
      </p>
      <h2 className="mt-1 text-lg font-bold text-zinc-900">{offer.headline}</h2>
      {offer.blurb ? <p className="mt-1 text-sm text-muted">{offer.blurb}</p> : null}

      <div className="mt-3 flex items-baseline justify-center gap-2">
        <span className="text-2xl font-bold">{formatRupees(offer.pricePaise)}</span>
        {saved > 0 ? (
          <>
            <span className="text-sm text-muted line-through">
              {formatRupees(offer.listPricePaise)}
            </span>
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              Save {formatRupees(saved)}
            </span>
          </>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted">{offer.offerProductTitle}</p>

      {error ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <button
        onClick={addOffer}
        disabled={phase === "buying"}
        className="mt-4 w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {phase === "buying" ? "Starting…" : `Add for ${formatRupees(offer.pricePaise)}`}
      </button>
      <button
        onClick={() => setPhase("done")}
        className="mt-2 w-full text-sm text-muted underline"
      >
        No thanks, continue
      </button>
    </div>
  );
}
