"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { formatRupees } from "@invoxai/utils/money";
import { PaymentSuccess } from "@invoxai/ui";
import {
  startWorkshopCheckout,
  startWorkshopUpiSession,
  previewWorkshopCoupon,
  joinFreeWorkshopAction,
} from "./actions";
import { firePurchase, fireInitiateCheckout } from "../../TrackingScripts";
import { UpiPayPanel, UpiSubmitted } from "../../UpiPayPanel";
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

export function WorkshopJoinBox({
  workshop,
  razorpayReady,
  upi,
  soldOut,
}: {
  workshop: { id: string; slug: string; title: string; pricePaise: number };
  razorpayReady: boolean;
  upi: { upiId: string; payeeName: string } | null;
  soldOut: boolean;
}) {
  const router = useRouter();
  const isFree = workshop.pricePaise <= 0;

  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [method, setMethod] = useState<"razorpay" | "upi">(razorpayReady ? "razorpay" : "upi");
  const [status, setStatus] = useState<Status>("idle");
  const [upiDone, setUpiDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; discountPaise: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const discount = applied ? Math.min(applied.discountPaise, workshop.pricePaise) : 0;
  const total = Math.max(0, workshop.pricePaise - discount);

  useEffect(() => {
    if (isFree) return;
    const c = readCouponCookie();
    if (!c) return;
    setCode(c);
    let cancelled = false;
    (async () => {
      setApplying(true);
      try {
        const res = await previewWorkshopCoupon(workshop.id, c);
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

  async function joinFree() {
    setError(null);
    setStatus("starting");
    const res = await joinFreeWorkshopAction(workshop.id);
    if (res.ok) {
      router.push(`/account/workshop/${res.slug}`);
      return;
    }
    if (res.needLogin) {
      router.push(`/account/login?next=/w/${workshop.slug}`);
      return;
    }
    setError(res.error);
    setStatus("idle");
  }

  async function applyPromo() {
    setApplying(true);
    setCouponMsg(null);
    try {
      const res = await previewWorkshopCoupon(workshop.id, code);
      if (res.ok) {
        setApplied({ code: res.code, discountPaise: res.discountPaise });
        setCode(res.code);
      } else {
        setApplied(null);
        setCouponMsg(res.error);
      }
    } finally {
      setApplying(false);
    }
  }

  async function buy() {
    setError(null);
    setStatus("starting");
    try {
      const result = await startWorkshopCheckout(workshop.id, { email, contact }, applied?.code);
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
        title="You’re registered!"
        subtitle="Payment successful — your workshop access is ready."
        ctaHref={`/account/workshop/${workshop.slug}`}
        ctaLabel="View workshop →"
      />
    );
  }

  if (upiDone) return <UpiSubmitted />;

  if (soldOut) {
    return (
      <p className="mt-5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
        This workshop is sold out.
      </p>
    );
  }

  // FREE workshop — a one-tap register (sign-in required, handled in the action).
  if (isFree) {
    return (
      <div className="mt-5">
        {error ? (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        <button
          onClick={joinFree}
          disabled={status === "starting"}
          className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {status === "starting" ? "Registering…" : "Register for free"}
        </button>
        <p className="mt-2 text-center text-xs text-muted">Sign in to register — it’s free.</p>
      </div>
    );
  }

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
          placeholder="Email (for access + receipt)"
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
          onClick={buy}
          disabled={status === "starting"}
          className="mt-3 w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {status === "starting" ? "Starting…" : `Register · ${formatRupees(total)}`}
        </button>
      ) : null}
      {method === "upi" && upi ? (
        <UpiPayPanel
          upi={upi}
          title={workshop.title}
          onStart={() => startWorkshopUpiSession(workshop.id, { email, contact }, applied?.code)}
          onConfirmed={() => setStatus("paid")}
          onSubmitted={() => setUpiDone(true)}
        />
      ) : null}
      <p className="mt-2 text-center text-xs text-muted">
        Use this email to sign in and access the workshop after paying.
      </p>
    </div>
  );
}
