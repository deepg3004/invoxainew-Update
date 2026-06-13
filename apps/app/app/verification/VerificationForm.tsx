"use client";

import { useActionState } from "react";
import { submitVerificationAction, type VerificationFormState } from "./actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

export function VerificationForm({ resubmit }: { resubmit?: boolean }) {
  const [state, action, pending] = useActionState<VerificationFormState, FormData>(
    submitVerificationAction,
    {},
  );

  if (state.ok) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Submitted — your store is now under review. We’ll update this page once an admin reviews it.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Business / legal name</span>
        <input name="legalName" required placeholder="Acme Pvt Ltd" className={inputCls} />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Anything that helps us verify you (optional)</span>
        <textarea
          name="details"
          rows={4}
          placeholder="Website, social profiles, GSTIN, what you sell…"
          className={`${inputCls} resize-y`}
        />
      </label>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Submitting…" : resubmit ? "Re-submit for verification" : "Submit for verification"}
      </button>
    </form>
  );
}
