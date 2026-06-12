"use client";

import { useState } from "react";
import Script from "next/script";
import { PaymentSuccess } from "@invoxai/ui";
import { startBuyerCheckout } from "./actions";
import { firePurchase, fireInitiateCheckout } from "../../TrackingScripts";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type Status = "idle" | "starting" | "paid";

export function PayBox({ paymentPageId }: { paymentPageId: string }) {
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function pay() {
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

  return (
    <div className="mt-5">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="space-y-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (for your receipt)"
          className="w-full rounded-lg border border-white/10 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <input
          inputMode="tel"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Phone (optional)"
          className="w-full rounded-lg border border-white/10 px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>
      {error ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <button
        onClick={pay}
        disabled={status === "starting"}
        className="mt-3 w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {status === "starting" ? "Starting…" : "Pay now"}
      </button>
    </div>
  );
}
