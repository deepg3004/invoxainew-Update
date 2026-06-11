"use client";

import { useActionState } from "react";
import { paiseToRupeeString } from "@invoxai/utils/money";
import { refundOrderAction } from "./actions";

/**
 * Per-order refund control. Defaults to the full remaining amount; the seller
 * can enter less for a partial refund. Confirms before issuing (it hits their
 * real gateway).
 */
export function RefundForm({
  orderId,
  remainingPaise,
}: {
  orderId: string;
  remainingPaise: number;
}) {
  const action = refundOrderAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("Issue this refund on your Razorpay account? This can't be undone.")) {
          e.preventDefault();
        }
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <span className="text-xs text-neutral-400">Refund ₹</span>
      <input
        name="amount"
        inputMode="decimal"
        defaultValue={paiseToRupeeString(remainingPaise)}
        className="w-24 rounded-lg border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-900"
      />
      <button
        disabled={pending}
        className="rounded-lg border border-red-300 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? "Refunding…" : "Refund"}
      </button>
      {state.error ? (
        <span className="w-full text-xs text-red-700">{state.error}</span>
      ) : state.ok ? (
        <span className="w-full text-xs text-green-700">{state.ok}</span>
      ) : null}
    </form>
  );
}
