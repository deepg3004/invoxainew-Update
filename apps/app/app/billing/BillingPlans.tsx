"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { bpsToPercentString } from "@invoxai/utils/money";
import { startCheckout } from "./actions";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type Cycle = "MONTHLY" | "YEARLY";

export interface PlanCard {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  commissionBps: number;
  maxProducts: number | null;
  maxAiPages: number | null;
  monthlyLabel: string;
  yearlyLabel: string;
}

function limit(n: number | null): string {
  return n === null ? "Unlimited" : String(n);
}

export function BillingPlans({
  plans,
  currentPlanId,
}: {
  plans: PlanCard[];
  currentPlanId: string | null;
}) {
  const router = useRouter();
  const [cycle, setCycle] = useState<Cycle>("MONTHLY");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function subscribe(plan: PlanCard) {
    setError(null);
    setPendingId(plan.id);
    try {
      const result = await startCheckout(plan.id, cycle);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.kind === "free") {
        startTransition(() => router.refresh());
        return;
      }

      if (!window.Razorpay) {
        setError("Payment library failed to load. Refresh and try again.");
        return;
      }

      const rzp = new window.Razorpay({
        key: result.keyId,
        order_id: result.orderId,
        amount: result.amountPaise,
        currency: "INR",
        name: "InvoxAI",
        description: `${result.planName} (${cycle.toLowerCase()})`,
        handler: async (response: Record<string, string>) => {
          // Confirm synchronously; the webhook is the authoritative backstop.
          const verify = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          if (verify.ok) {
            startTransition(() => router.refresh());
          } else {
            setError(
              "Payment captured — confirming may take a moment. Refresh shortly.",
            );
          }
        },
      });
      rzp.open();
    } catch {
      setError("Could not start checkout. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="mt-4">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-1 text-sm">
        {(["MONTHLY", "YEARLY"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCycle(c)}
            className={`rounded-md px-3 py-1.5 font-medium ${
              cycle === c ? "bg-neutral-900 text-white" : "text-neutral-500"
            }`}
          >
            {c === "MONTHLY" ? "Monthly" : "Yearly"}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {plans.map((p) => {
          const priceLabel = cycle === "MONTHLY" ? p.monthlyLabel : p.yearlyLabel;
          const isCurrent = p.id === currentPlanId;
          return (
            <div
              key={p.id}
              className="flex flex-col rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-neutral-900">{p.name}</h3>
              <p className="mt-1 text-2xl font-bold">
                {priceLabel}
                <span className="text-sm font-normal text-neutral-400">
                  /{cycle === "MONTHLY" ? "mo" : "yr"}
                </span>
              </p>
              {p.description ? (
                <p className="mt-2 text-sm text-neutral-500">{p.description}</p>
              ) : null}
              <ul className="mt-4 space-y-1 text-sm text-neutral-600">
                <li>{bpsToPercentString(p.commissionBps)}% commission</li>
                <li>{limit(p.maxProducts)} products</li>
                <li>{limit(p.maxAiPages)} AI pages</li>
              </ul>
              <button
                onClick={() => subscribe(p)}
                disabled={pendingId !== null || isCurrent}
                className="mt-5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {isCurrent
                  ? "Current plan"
                  : pendingId === p.id
                    ? "Starting…"
                    : "Subscribe"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
