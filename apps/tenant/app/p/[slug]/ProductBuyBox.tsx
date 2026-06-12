"use client";

import { useState } from "react";
import Script from "next/script";
import { startProductCheckout } from "./actions";
import { firePurchase } from "../../TrackingScripts";
import { AddToCartButton } from "../../AddToCartButton";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type Status = "idle" | "starting" | "paid";

export interface BuyBoxProduct {
  id: string;
  slug: string;
  title: string;
  pricePaise: number;
  imageUrl: string | null;
  stockQty: number | null;
}

export function ProductBuyBox({ product }: { product: BuyBoxProduct }) {
  const productId = product.id;
  const maxQty = product.stockQty;
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const cap = maxQty === null ? 99 : Math.min(maxQty, 99);

  async function buy() {
    setError(null);
    setStatus("starting");
    try {
      const result = await startProductCheckout(productId, qty, { email, contact });
      if (!result.ok) {
        setError(result.error);
        setStatus("idle");
        return;
      }
      if (!window.Razorpay) {
        setError("Payment library failed to load. Refresh and try again.");
        setStatus("idle");
        return;
      }

      const rzp = new window.Razorpay({
        key: result.keyId,
        order_id: result.orderId,
        amount: result.amountPaise,
        currency: "INR",
        name: result.title,
        prefill: { email, contact },
        handler: async (response: Record<string, string>) => {
          const verify = await fetch("/api/pay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          if (verify.ok) {
            firePurchase(result.amountPaise);
            setStatus("paid");
          } else {
            setError("Payment received — confirming. If you were charged, you’re all set.");
            setStatus("idle");
          }
        },
        modal: { ondismiss: () => setStatus("idle") },
      });
      rzp.open();
    } catch {
      setError("Could not start payment. Please try again.");
      setStatus("idle");
    }
  }

  if (status === "paid") {
    return (
      <div className="mt-5 rounded-md bg-green-50 px-3 py-3 text-center text-sm font-medium text-green-700">
        ✓ Payment successful. Thank you!
        <a href="/account" className="mt-1 block text-xs font-normal text-green-800 underline">
          View it in your orders
        </a>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      {cap === 0 ? (
        <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-500">
          Sold out
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-neutral-600">Quantity</span>
              <select
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
              >
                {Array.from({ length: cap }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (for your receipt)"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
            <input
              inputMode="tel"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Phone (optional)"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </div>
          {error ? (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <button
            onClick={buy}
            disabled={status === "starting"}
            className="mt-3 w-full rounded-lg bg-neutral-900 px-4 py-2.5 font-medium text-white disabled:opacity-50"
          >
            {status === "starting" ? "Starting…" : "Buy now"}
          </button>
          <div className="mt-2">
            <AddToCartButton
              product={{
                productId: product.id,
                slug: product.slug,
                title: product.title,
                pricePaise: product.pricePaise,
                imageUrl: product.imageUrl,
                maxQty: product.stockQty,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
