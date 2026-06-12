"use client";

import { useState } from "react";
import Script from "next/script";
import { formatRupees } from "@invoxai/utils/money";
import { useCart, setQty, removeFromCart, clearCart } from "../../lib/cart";
import { startCartCheckout } from "./actions";
import { firePurchase } from "../TrackingScripts";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type Status = "idle" | "starting" | "paid";

export function CartView() {
  const items = useCart();
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const subtotal = items.reduce((n, i) => n + i.pricePaise * i.qty, 0);

  async function checkout() {
    setError(null);
    setStatus("starting");
    try {
      const lines = items.map((i) => ({ productId: i.productId, qty: i.qty }));
      const result = await startCartCheckout(lines, { email, contact });
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
            clearCart();
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
      setError("Could not start checkout. Please try again.");
      setStatus("idle");
    }
  }

  if (status === "paid") {
    return (
      <div className="mt-6 rounded-md bg-green-50 px-3 py-3 text-center text-sm font-medium text-green-700">
        ✓ Payment successful. Thank you!
        <a href="/account" className="mt-1 block text-xs font-normal text-green-800 underline">
          View it in your orders
        </a>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="mt-6 text-neutral-500">
        Your cart is empty.{" "}
        <a href="/store" className="text-blue-600 underline">
          Browse the store →
        </a>
      </p>
    );
  }

  return (
    <div className="mt-6">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
        {items.map((i) => {
          const cap = i.maxQty === null ? 99 : Math.min(i.maxQty, 99);
          return (
            <li key={i.productId} className="flex items-center gap-3 p-3">
              {i.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={i.imageUrl}
                  alt={i.title}
                  className="h-14 w-14 rounded-lg border border-neutral-100 object-cover"
                />
              ) : (
                <div className="h-14 w-14 rounded-lg bg-neutral-50" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{i.title}</div>
                <div className="text-xs text-neutral-500">{formatRupees(i.pricePaise)} each</div>
              </div>
              <select
                value={i.qty}
                onChange={(e) => setQty(i.productId, Number(e.target.value))}
                className="rounded-lg border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-900"
              >
                {Array.from({ length: cap }, (_, n) => n + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeFromCart(i.productId)}
                className="text-xs text-neutral-400 hover:text-red-600"
                aria-label={`Remove ${i.title}`}
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-neutral-600">Subtotal</span>
        <span className="font-semibold">{formatRupees(subtotal)}</span>
      </div>

      <div className="mt-4 space-y-2">
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
        onClick={checkout}
        disabled={status === "starting"}
        className="mt-3 w-full rounded-lg bg-neutral-900 px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {status === "starting" ? "Starting…" : `Pay ${formatRupees(subtotal)}`}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">
        Paid securely via Razorpay. Final total is confirmed at checkout.
      </p>
    </div>
  );
}
