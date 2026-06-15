"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createExperimentAction } from "../actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

export function NewExperimentForm({ pages }: { pages: { id: string; title: string }[] }) {
  const [state, formAction, pending] = useActionState(createExperimentAction, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Payment page</span>
        <select name="paymentPageId" required defaultValue="" className={inputCls}>
          <option value="" disabled>
            Select a page…
          </option>
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-muted">
          Variant A is this page&apos;s current headline. Variant B is the alternative below.
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Variant B headline</span>
        <input
          name="variantBTitle"
          required
          maxLength={200}
          placeholder="An alternative headline to test"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Variant B description (optional)</span>
        <textarea
          name="variantBDescription"
          rows={3}
          maxLength={1000}
          placeholder="Leave blank to keep the page's current description for variant B."
          className={inputCls}
        />
      </label>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Starting…" : "Start A/B test"}
        </button>
        <Link href="/experiments" className="text-sm text-muted underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
