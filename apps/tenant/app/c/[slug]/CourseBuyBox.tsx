"use client";

import { useState } from "react";
import Script from "next/script";
import { formatRupees } from "@invoxai/utils/money";
import { startCourseCheckout, previewCourseCoupon } from "./actions";
import { firePurchase } from "../../TrackingScripts";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type Status = "idle" | "starting" | "paid";

export function CourseBuyBox({
  course,
}: {
  course: { id: string; slug: string; title: string; pricePaise: number };
}) {
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; discountPaise: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const discount = applied ? Math.min(applied.discountPaise, course.pricePaise) : 0;
  const total = Math.max(0, course.pricePaise - discount);

  async function applyPromo() {
    setApplying(true);
    setCouponMsg(null);
    try {
      const res = await previewCourseCoupon(course.id, code);
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
      const result = await startCourseCheckout(course.id, { email, contact }, applied?.code);
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
        ✓ Payment successful — you’re enrolled!
        <a
          href={`/account/learn/${course.slug}`}
          className="mt-1 block text-xs font-normal text-green-800 underline"
        >
          Start learning →
        </a>
      </div>
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
          placeholder="Email (for access + receipt)"
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

      <div className="mt-3 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Promo code"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm uppercase outline-none focus:border-neutral-900"
        />
        <button
          type="button"
          onClick={applyPromo}
          disabled={applying || code.trim() === ""}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-900 disabled:opacity-50"
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
      <button
        onClick={buy}
        disabled={status === "starting"}
        className="mt-3 w-full rounded-lg bg-neutral-900 px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {status === "starting" ? "Starting…" : `Enrol · ${formatRupees(total)}`}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">
        Paid securely via Razorpay. Sign in with this email to access your course.
      </p>
    </div>
  );
}
