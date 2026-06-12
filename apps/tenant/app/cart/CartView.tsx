"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { formatRupees } from "@invoxai/utils/money";
import { PaymentSuccess } from "@invoxai/ui";
import { useCart, setQty, removeFromCart, clearCart } from "../../lib/cart";
import { startCartCheckout, previewCartCoupon } from "./actions";
import { firePurchase, fireInitiateCheckout } from "../TrackingScripts";

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
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; discountPaise: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const subtotal = items.reduce((n, i) => n + i.pricePaise * i.qty, 0);
  const discount = applied ? Math.min(applied.discountPaise, subtotal) : 0;
  const total = Math.max(0, subtotal - discount);

  // If the cart contents change after a code was applied, the discount is stale —
  // drop it so the buyer re-applies against the new subtotal. (Checkout also
  // re-validates server-side, so this is just to keep the displayed total honest.)
  useEffect(() => {
    setApplied(null);
    setCouponMsg(null);
  }, [subtotal]);

  async function applyPromo() {
    setApplying(true);
    setCouponMsg(null);
    try {
      const lines = items.map((i) => ({ productId: i.productId, qty: i.qty }));
      const res = await previewCartCoupon(lines, code);
      if (res.ok) {
        setApplied({ code: res.code, discountPaise: res.discountPaise });
        setCode(res.code);
      } else {
        setApplied(null);
        setCouponMsg(res.error);
      }
    } catch {
      setCouponMsg("Couldn’t check that code. Try again.");
    } finally {
      setApplying(false);
    }
  }

  async function checkout() {
    setError(null);
    setStatus("starting");
    try {
      const lines = items.map((i) => ({ productId: i.productId, qty: i.qty }));
      const result = await startCartCheckout(lines, { email, contact }, applied?.code);
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

      fireInitiateCheckout(result.amountPaise);
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
      <PaymentSuccess
        title="Payment successful"
        subtitle="Thank you! Your order is confirmed."
        ctaHref="/account"
        ctaLabel="View it in your orders"
      />
    );
  }

  if (items.length === 0) {
    return (
      <p className="mt-6 text-muted">
        Your cart is empty.{" "}
        <a href="/store" className="text-cyan underline">
          Browse the store →
        </a>
      </p>
    );
  }

  return (
    <div className="mt-6">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-surface">
        {items.map((i) => {
          const cap = i.maxQty === null ? 99 : Math.min(i.maxQty, 99);
          return (
            <li key={i.productId} className="flex items-center gap-3 p-3">
              {i.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={i.imageUrl}
                  alt={i.title}
                  className="h-14 w-14 rounded-lg border border-zinc-200 object-cover"
                />
              ) : (
                <div className="h-14 w-14 rounded-lg bg-zinc-50" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{i.title}</div>
                <div className="text-xs text-muted">{formatRupees(i.pricePaise)} each</div>
              </div>
              <select
                value={i.qty}
                onChange={(e) => setQty(i.productId, Number(e.target.value))}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-brand"
              >
                {Array.from({ length: cap }, (_, n) => n + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeFromCart(i.productId)}
                className="text-xs text-muted hover:text-red-600"
                aria-label={`Remove ${i.title}`}
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>

      {/* Promo code */}
      <div className="mt-4">
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Promo code"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm uppercase text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={applyPromo}
            disabled={applying || code.trim() === ""}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:border-brand/40 disabled:opacity-50"
          >
            {applying ? "…" : "Apply"}
          </button>
        </div>
        {couponMsg ? (
          <p className="mt-1.5 text-xs text-red-600">{couponMsg}</p>
        ) : null}
        {applied ? (
          <p className="mt-1.5 text-xs font-medium text-green-700">
            Code {applied.code} applied — {formatRupees(discount)} off
          </p>
        ) : null}
      </div>

      <div className="mt-4 space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted">Subtotal</span>
          <span>{formatRupees(subtotal)}</span>
        </div>
        {discount > 0 ? (
          <div className="flex items-center justify-between text-green-700">
            <span>Discount{applied ? ` (${applied.code})` : ""}</span>
            <span>−{formatRupees(discount)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between border-t border-zinc-200 pt-1 font-semibold">
          <span>Total</span>
          <span>{formatRupees(total)}</span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (for your receipt)"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
        />
        <input
          inputMode="tel"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Phone (optional)"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
        />
      </div>

      {error ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <button
        onClick={checkout}
        disabled={status === "starting"}
        className="mt-3 w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {status === "starting" ? "Starting…" : `Pay ${formatRupees(total)}`}
      </button>
      <p className="mt-2 text-center text-xs text-muted">
        Paid securely via Razorpay. Final total is confirmed at checkout.
      </p>
    </div>
  );
}
