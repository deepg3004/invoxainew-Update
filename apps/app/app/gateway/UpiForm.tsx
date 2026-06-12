"use client";

import { useActionState } from "react";
import { saveUpiAction, type UpiFormState } from "./actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

export function UpiForm({
  initial,
}: {
  initial?: { upiId: string; displayName: string | null; enabled: boolean } | null;
}) {
  const [state, action, pending] = useActionState<UpiFormState, FormData>(saveUpiAction, {});

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
        {pending ? "Saving…" : "Save UPI"}
      </button>
    </form>
  );
}
