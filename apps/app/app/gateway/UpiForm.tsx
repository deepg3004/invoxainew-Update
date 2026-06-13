"use client";

import { useActionState, useState } from "react";
import { saveUpiAction, type UpiFormState } from "./actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

export function UpiForm({
  initial,
}: {
  initial?: {
    upiId: string;
    displayName: string | null;
    enabled: boolean;
    autoConfirm: boolean;
    autoConfirmMaxPaise: number | null;
    sessionTtlMinutes: number;
  } | null;
}) {
  const [state, action, pending] = useActionState<UpiFormState, FormData>(saveUpiAction, {});
  const [autoConfirm, setAutoConfirm] = useState(initial?.autoConfirm ?? true);

  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="text-sm font-medium text-zinc-900">UPI ID</span>
        <input
          name="upiId"
          defaultValue={initial?.upiId ?? ""}
          placeholder="name@okhdfc"
          className={`${inputCls} font-mono`}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-900">Payee name (optional)</span>
        <input
          name="displayName"
          defaultValue={initial?.displayName ?? ""}
          placeholder="Your name or business"
          className={inputCls}
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input type="checkbox" name="enabled" defaultChecked={initial?.enabled ?? true} /> Offer UPI
        as a checkout option
      </label>

      {/* Auto-confirm settings */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-900">
          <input
            type="checkbox"
            name="autoConfirm"
            checked={autoConfirm}
            onChange={(e) => setAutoConfirm(e.target.checked)}
          />
          Auto-confirm payments instantly
        </label>
        <p className="mt-1 text-xs text-muted">
          When on, an order is finalised — and access granted — the moment the buyer submits their
          UPI reference, and the InvoxAI commission is charged then. No manual step. The reference
          isn’t bank-verified, so if a payment doesn’t actually arrive, use “Cancel — payment not
          received” on the order (it reverses the commission and the access).
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-zinc-700">
              Manual-review above (₹, optional)
            </span>
            <input
              name="autoConfirmMax"
              inputMode="decimal"
              defaultValue={
                initial?.autoConfirmMaxPaise != null
                  ? (initial.autoConfirmMaxPaise / 100).toString()
                  : ""
              }
              placeholder="e.g. 2000"
              disabled={!autoConfirm}
              className={`${inputCls} disabled:opacity-50`}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-700">QR expires after (min)</span>
            <input
              name="sessionTtl"
              type="number"
              min={2}
              max={60}
              defaultValue={initial?.sessionTtlMinutes ?? 10}
              className={inputCls}
            />
          </label>
        </div>
        <p className="mt-1 text-xs text-muted">
          Orders above the cap stay in your manual “Awaiting UPI confirmation” queue.
        </p>
      </div>

      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">UPI saved ✓</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save UPI gateway"}
      </button>
    </form>
  );
}
