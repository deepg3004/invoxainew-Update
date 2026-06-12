"use client";

import { useState } from "react";
import Script from "next/script";
import { PaymentSuccess } from "@invoxai/ui";
import { formatRupees } from "@invoxai/utils/money";
import { startBuyerCheckout, submitUpiPayment } from "./actions";
import { firePurchase, fireInitiateCheckout } from "../../TrackingScripts";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type Status = "idle" | "starting" | "paid" | "upiSubmitting" | "upiSubmitted";

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
  upi,
}: {
  paymentPageId: string;
  title: string;
  amountPaise: number;
  razorpayReady: boolean;
  upi: { upiId: string; payeeName: string } | null;
}) {
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [upiRef, setUpiRef] = useState("");
  const [method, setMethod] = useState<"razorpay" | "upi">(razorpayReady ? "razorpay" : "upi");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function payRazorpay() {
    setError(null);
    setStatus("starting");
    try {
      const result = await startBuyerCheckout(paymentPageId, { email, contact });
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

  async function payUpi() {
    setError(null);
    setStatus("upiSubmitting");
    try {
      const res = await submitUpiPayment(paymentPageId, { email, contact, upiRef });
      if (res.ok) setStatus("upiSubmitted");
      else {
        setError(res.error);
        setStatus("idle");
      }
    } catch {
      setError("Couldn’t submit. Please try again.");
      setStatus("idle");
    }
  }

  if (status === "paid") {
    return (
      <PaymentSuccess
        title="Payment successful"
        subtitle="Thank you! Your payment is confirmed."
        ctaHref="/account"
        ctaLabel="View it in your orders"
      />
    );
  }

  if (status === "upiSubmitted") {
    return (
      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-6 text-center">
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

  const upiLink = upi
    ? `upi://pay?pa=${encodeURIComponent(upi.upiId)}&pn=${encodeURIComponent(
        upi.payeeName,
      )}&am=${(amountPaise / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(title)}`
    : "";

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

      {error ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {method === "razorpay" && razorpayReady ? (
        <button
          onClick={payRazorpay}
          disabled={status === "starting"}
          className="mt-3 w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {status === "starting" ? "Starting…" : "Pay now"}
        </button>
      ) : null}

      {method === "upi" && upi ? (
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
            className={inputCls}
          />
          <button
            onClick={payUpi}
            disabled={status === "upiSubmitting"}
            className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-50"
          >
            {status === "upiSubmitting" ? "Submitting…" : "I’ve paid — submit"}
          </button>
          <p className="text-xs text-muted">
            Pay the amount to the UPI ID above in your UPI app, then paste the transaction reference
            (UTR) here. The seller confirms it and your order is finalised.
          </p>
        </div>
      ) : null}
    </div>
  );
}
