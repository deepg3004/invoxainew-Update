"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { formatRupees } from "@invoxai/utils/money";
import { PaymentSuccess } from "@invoxai/ui";
import { startProductCheckout, previewProductCoupon } from "./actions";
import { firePurchase, fireInitiateCheckout } from "../../TrackingScripts";
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
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; discountPaise: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const cap = maxQty === null ? 99 : Math.min(maxQty, 99);
  const subtotal = product.pricePaise * qty;
  const discount = applied ? Math.min(applied.discountPaise, subtotal) : 0;
  const total = Math.max(0, subtotal - discount);

  // Drop a stale discount when quantity changes (checkout re-validates anyway).
  useEffect(() => {
    setApplied(null);
    setCouponMsg(null);
  }, [qty]);

  async function applyPromo() {
    setApplying(true);
    setCouponMsg(null);
    try {
      const res = await previewProductCoupon(productId, qty, code);
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

  async function buy() {
    setError(null);
    setStatus("starting");
    try {
      const result = await startProductCheckout(productId, qty, { email, contact }, applied?.code);
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
      <PaymentSuccess
        title="Payment successful"
        subtitle="Thank you! Your order is confirmed."
        ctaHref="/account"
        ctaLabel="View it in your orders"
      />
    );
  }

  return (
    <div className="mt-5">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      {cap === 0 ? (
        <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-muted">
          Sold out
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">Quantity</span>
              <select
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-brand"
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
          {/* Promo code */}
          <div className="mt-3 flex gap-2">
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
          {discount > 0 ? (
            <p className="mt-1.5 text-xs font-medium text-green-700">
              Code {applied?.code} applied — {formatRupees(discount)} off
            </p>
          ) : null}

          {error ? (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <button
            onClick={buy}
            disabled={status === "starting"}
            className="mt-3 w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-50"
          >
            {status === "starting" ? "Starting…" : `Buy now · ${formatRupees(total)}`}
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
