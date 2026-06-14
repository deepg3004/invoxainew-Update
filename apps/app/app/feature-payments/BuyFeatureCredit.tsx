"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { formatRupees } from "@invoxai/utils/money";
import { runRazorpayCheckout } from "../../lib/checkout-client";
import { startFeaturePayment } from "./actions";

/**
 * Buy a single prepaid credit for a paid feature via the platform gateway. On
 * success the webhook/verify mints a FeatureCharge credit that the next use of
 * the feature consumes automatically (instead of the wallet). Mirrors the wallet
 * top-up checkout flow.
 */
export function BuyFeatureCredit({
  featureKey,
  featureName,
  pricePaise,
}: {
  featureKey: string;
  featureName: string;
  pricePaise: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function buy() {
    setError(null);
    setBusy(true);
    try {
      const result = await startFeaturePayment(featureKey);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const outcome = await runRazorpayCheckout({
        keyId: result.keyId,
        orderId: result.orderId,
        amountPaise: result.amountPaise,
        name: "InvoxAI",
        description: `${featureName} credit`,
      });
      if (outcome.status === "paid") {
        startTransition(() => router.refresh());
      } else if (outcome.status === "pending") {
        setError("Payment captured — your credit will appear shortly. Refresh in a moment.");
      } else {
        setError(outcome.message);
      }
    } catch {
      setError("Could not start payment. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <button
        type="button"
        onClick={buy}
        disabled={busy}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "Starting…" : `Buy a credit · ${formatRupees(pricePaise)}`}
      </button>
      {error ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
