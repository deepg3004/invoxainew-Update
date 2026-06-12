"use client";

import { useActionState } from "react";
import { adjustWalletAction } from "./actions";

export function WalletAdjustForm({ tenantId }: { tenantId: string }) {
  const action = adjustWalletAction.bind(null, tenantId);
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : state.ok ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{state.ok}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="direction"
          defaultValue="CREDIT"
          className="rounded-lg border border-white/10 px-2 py-1.5 text-sm"
        >
          <option value="CREDIT">Credit (+)</option>
          <option value="DEBIT">Debit (−)</option>
        </select>
        <div className="flex items-center gap-1">
          <span className="text-muted">₹</span>
          <input
            name="amount"
            inputMode="decimal"
            placeholder="0.00"
            className="w-28 rounded-lg border border-white/10 px-2 py-1.5 text-sm"
          />
        </div>
        <input
          name="reason"
          placeholder="Reason (logged)"
          className="min-w-48 flex-1 rounded-lg border border-white/10 px-2 py-1.5 text-sm"
        />
        <button
          disabled={pending}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Applying…" : "Apply"}
        </button>
      </div>
    </form>
  );
}
