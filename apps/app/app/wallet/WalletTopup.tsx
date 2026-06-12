"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { rupeeStringToPaise } from "@invoxai/utils/money";
import { runRazorpayCheckout } from "../../lib/checkout-client";
import { startWalletTopup } from "./actions";

const PRESETS = [500, 1000, 2000, 5000]; // rupees

export function WalletTopup() {
  const router = useRouter();
  const [amount, setAmount] = useState("500");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function topup() {
    setError(null);
    const parsed = rupeeStringToPaise(amount);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    setBusy(true);
    try {
      const result = await startWalletTopup(parsed.paise);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const outcome = await runRazorpayCheckout({
        keyId: result.keyId,
        orderId: result.orderId,
        amountPaise: result.amountPaise,
        name: "InvoxAI wallet",
        description: "Wallet top-up",
      });
      if (outcome.status === "paid") {
        startTransition(() => router.refresh());
      } else if (outcome.status === "pending") {
        setError("Payment captured — your balance will update shortly. Refresh in a moment.");
      } else {
        setError(outcome.message);
      }
    } catch {
      setError("Could not start top-up. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setAmount(String(r))}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              amount === String(r)
                ? "border-zinc-200 bg-brand text-white"
                : "border-zinc-200 hover:bg-zinc-100"
            }`}
          >
            ₹{r}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-muted">₹</span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
        />
        <button
          type="button"
          onClick={topup}
          disabled={busy}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Starting…" : "Add money"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
