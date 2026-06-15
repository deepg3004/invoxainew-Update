"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { PaymentSuccess } from "@invoxai/ui";
import { formatRupees } from "@invoxai/utils/money";
import { startBuyerCheckout, startPayUpiSession, previewPayCoupon } from "./actions";
import { firePurchase, fireInitiateCheckout } from "../../TrackingScripts";
import { UpiPayPanel, UpiSubmitted } from "../../UpiPayPanel";
import { readCouponCookie } from "../../../lib/coupon-cookie";
import { OtoOffer } from "./OtoOffer";
import { readExperimentVariant } from "./ExperimentTitle";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type Status = "idle" | "starting" | "paid";

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

function tabCls(active: boolean): string {
  return `flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
    active ? "border-brand bg-brand/10 text-brand-strong" : "border-zinc-200 text-muted hover:bg-zinc-50"
  }`;
}

export function PayBox({
  paymentPageId,
  title,
  amountPaise,
  razorpayReady,
  experimentId,
  upi,
}: {
  paymentPageId: string;
  title: string;
  amountPaise: number;
  razorpayReady: boolean;
  experimentId?: string | null;
  upi: { upiId: string; payeeName: string } | null;
}) {
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [method, setMethod] = useState<"razorpay" | "upi">(razorpayReady ? "razorpay" : "upi");
  const [status, setStatus] = useState<Status>("idle");
  const [paidOrderId, setPaidOrderId] = useState<string | null>(null);
  const [upiDone, setUpiDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; discountPaise: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const discount = applied ? Math.min(applied.discountPaise, amountPaise) : 0;
  const total = Math.max(0, amountPaise - discount);

  // A/B: count a conversion for the visitor's bucketed variant on a confirmed payment.
  function fireExperimentConversion() {
    if (!experimentId) return;
    const variant = readExperimentVariant(experimentId);
    if (!variant) return;
    void fetch("/api/exp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: experimentId, variant, kind: "conversion" }),
      keepalive: true,
    }).catch(() => {});
  }

  async function applyPromo() {
    setApplying(true);
    setCouponMsg(null);
    try {
      const res = await previewPayCoupon(paymentPageId, code);
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

  // Share-link coupon: auto-apply a ?coupon=… captured to the cookie. Once, on mount.
  useEffect(() => {
    const c = readCouponCookie();
    if (!c) return;
    setCode(c);
    let cancelled = false;
    (async () => {
      setApplying(true);
      try {
        const res = await previewPayCoupon(paymentPageId, c);
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

  async function payRazorpay() {
    setError(null);
    setStatus("starting");
    try {
      const result = await startBuyerCheckout(paymentPageId, { email, contact }, applied?.code);
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
            fireExperimentConversion();
            setPaidOrderId(result.orderId);
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
    // After a Razorpay payment we have the order id → offer a post-purchase OTO
    // (OtoOffer falls back to the plain success card when there's no active offer).
    // The UPI path has no order handle here, so it shows the success card directly.
    return paidOrderId ? (
      <OtoOffer parentOrderId={paidOrderId} />
    ) : (
      <PaymentSuccess
        title="Payment successful"
        subtitle="Thank you! Your payment is confirmed."
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

      <div className="space-y-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (for your receipt)"
          className={inputCls}
        />
        <input
          inputMode="tel"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Phone (optional)"
          className={inputCls}
        />
      </div>

      {/* Promo code */}
      <div className="mt-3 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Promo code"
          className={`flex-1 uppercase ${inputCls}`}
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
      {couponMsg ? <p className="mt-1.5 text-xs text-red-600">{couponMsg}</p> : null}
      {discount > 0 ? (
        <p className="mt-1.5 text-xs font-medium text-green-700">
          Code {applied?.code} applied — {formatRupees(discount)} off
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {method === "razorpay" && razorpayReady ? (
        <button
          onClick={payRazorpay}
          disabled={status === "starting"}
          className="mt-3 w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {status === "starting" ? "Starting…" : `Pay ${formatRupees(total)}`}
        </button>
      ) : null}

      {method === "upi" && upi ? (
        <UpiPayPanel
          upi={upi}
          title={title}
          onStart={() => startPayUpiSession(paymentPageId, { email, contact }, applied?.code)}
          onConfirmed={() => {
            fireExperimentConversion();
            setStatus("paid");
          }}
          onSubmitted={() => setUpiDone(true)}
        />
      ) : null}
    </div>
  );
}
