"use client";

import { useActionState } from "react";
import { createAffiliateAction, type AffiliateFormState } from "./actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

/** Create-affiliate form. Stays on the page (no redirect) so the seller can add
 * several partners in a row; the list revalidates after each add. */
export function AffiliateForm() {
  const [state, formAction, pending] = useActionState<AffiliateFormState, FormData>(
    createAffiliateAction,
    {},
  );

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="text-xs font-medium text-zinc-700">Partner name</span>
        <input name="name" placeholder="Riya Sharma" className={inputCls} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-zinc-700">Email (optional)</span>
        <input name="email" type="email" placeholder="riya@example.com" className={inputCls} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-zinc-700">Referral code</span>
        <input
          name="code"
          placeholder="RIYA10"
          className={`${inputCls} uppercase`}
          autoCapitalize="characters"
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-zinc-700">Commission %</span>
        <input name="commission" inputMode="decimal" placeholder="10" className={inputCls} />
      </label>
      {state.error ? (
        <p className="sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add affiliate"}
        </button>
      </div>
    </form>
  );
}
