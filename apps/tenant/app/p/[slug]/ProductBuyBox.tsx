"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { formatRupees } from "@invoxai/utils/money";
import { PaymentSuccess } from "@invoxai/ui";
import { startProductCheckout, startProductUpiSession, previewProductCoupon } from "./actions";
import { firePurchase, fireInitiateCheckout } from "../../TrackingScripts";
import { AddToCartButton } from "../../AddToCartButton";
import { UpiPayPanel, UpiSubmitted } from "../../UpiPayPanel";
import { OrderBumpOption, type BumpInfo } from "../../OrderBumpOption";
import { readCouponCookie } from "../../../lib/coupon-cookie";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type Status = "idle" | "starting" | "paid";

function tabCls(active: boolean): string {
  return `flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
    active ? "border-brand bg-brand/10 text-brand-strong" : "border-zinc-200 text-muted hover:bg-zinc-50"
  }`;
}

export interface BuyBoxProduct {
  id: string;
  slug: string;
  title: string;
  pricePaise: number;
  imageUrl: string | null;
  stockQty: number | null;
}

export interface BuyBoxVariant {
  id: string;
  label: string;
  pricePaise: number;
  stockQty: number | null;
}

export function ProductBuyBox({
  product,
  razorpayReady,
  upi,
  bump,
  variants = [],
}: {
  product: BuyBoxProduct;
  razorpayReady: boolean;
  upi: { upiId: string; payeeName: string } | null;
  bump: BumpInfo | null;
  variants?: BuyBoxVariant[];
}) {
  const productId = product.id;
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [qty, setQty] = useState(1);
  // Variant selection: default to the first variant when the product has any.
  const [variantId, setVariantId] = useState<string | null>(variants[0]?.id ?? null);
  const selectedVariant = variants.find((v) => v.id === variantId) ?? null;
  // Server re-prices regardless; these drive display + stock cap only.
  const unitPricePaise = selectedVariant?.pricePaise ?? product.pricePaise;
  const maxQty = variants.length > 0 ? (selectedVariant?.stockQty ?? null) : product.stockQty;
  const [method, setMethod] = useState<"razorpay" | "upi">(razorpayReady ? "razorpay" : "upi");
  const [status, setStatus] = useState<Status>("idle");
  const [upiDone, setUpiDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; discountPaise: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [addBump, setAddBump] = useState(false);

  const cap = maxQty === null ? 99 : Math.min(maxQty, 99);
  const subtotal = unitPricePaise * qty;
  const discount = applied ? Math.min(applied.discountPaise, subtotal) : 0;
  // The bump is added at full price on top of the (discounted) product subtotal —
  // the server re-applies the coupon to the combined total, so the buyer is never
  // charged MORE than shown (a % coupon there discounts the bump too).
  const total = Math.max(0, subtotal - discount) + (addBump && bump ? bump.pricePaise : 0);

  // Drop a stale discount when quantity OR variant changes (checkout re-validates).
  useEffect(() => {
    setApplied(null);
    setCouponMsg(null);
  }, [qty, variantId]);

  // Share-link coupon: if the buyer arrived via ?coupon=… (captured to a cookie),
  // pre-fill + auto-apply it on mount. Runs once; checkout re-validates regardless.
  useEffect(() => {
    const c = readCouponCookie();
    if (!c) return;
    setCode(c);
    let cancelled = false;
    (async () => {
      setApplying(true);
      try {
        const res = await previewProductCoupon(productId, 1, c);
        if (!cancelled && res.ok) setApplied({ code: res.code, discountPaise: res.discountPaise });
      } finally {
        if (!cancelled) setApplying(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const result = await startProductCheckout(
        productId,
        qty,
        { email, contact },
        applied?.code,
        addBump,
        variantId,
      );
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

  if (upiDone) return <UpiSubmitted />;

  return (
    <div className="mt-5">
      {razorpayReady ? (
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      ) : null}
      {cap === 0 ? (
        <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-muted">
          Sold out
        </p>
      ) : (
        <>
          {razorpayReady && upi ? (
            <div className="mb-3 flex gap-2">
              <button type="button" onClick={() => setMethod("razorpay")} className={tabCls(method === "razorpay")}>
                Card / Netbanking
              </button>
              <button type="button" onClick={() => setMethod("upi")} className={tabCls(method === "upi")}>
                UPI
              </button>
            </div>
          ) : null}
          {variants.length > 0 ? (
            <div className="mb-3">
              <span className="text-sm text-muted">Options</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {variants.map((v) => {
                  const out = v.stockQty === 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={out}
                      onClick={() => setVariantId(v.id)}
                      className={`rounded-lg border px-3 py-1.5 text-sm ${
                        v.id === variantId
                          ? "border-brand bg-brand/10 text-brand-strong"
                          : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                      } ${out ? "opacity-40" : ""}`}
                    >
                      {v.label}
                      {out ? " (sold out)" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
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

          {bump ? <OrderBumpOption bump={bump} checked={addBump} onChange={setAddBump} /> : null}

          {error ? (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          {method === "razorpay" && razorpayReady ? (
            <button
              onClick={buy}
              disabled={status === "starting"}
              className="mt-3 w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-50"
            >
              {status === "starting" ? "Starting…" : `Buy now · ${formatRupees(total)}`}
            </button>
          ) : null}
          {method === "upi" && upi ? (
            <UpiPayPanel
              upi={upi}
              title={product.title}
              onStart={() =>
                startProductUpiSession(productId, qty, { email, contact }, applied?.code, addBump, variantId)
              }
              onConfirmed={() => setStatus("paid")}
              onSubmitted={() => setUpiDone(true)}
            />
          ) : null}
          <div className="mt-2">
            <AddToCartButton
              product={{
                productId: product.id,
                slug: product.slug,
                title: product.title,
                pricePaise: unitPricePaise,
                imageUrl: product.imageUrl,
                maxQty: maxQty,
                variantId: variantId,
                variantLabel: selectedVariant?.label ?? null,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
