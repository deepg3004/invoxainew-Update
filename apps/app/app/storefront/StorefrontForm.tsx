"use client";

import { useActionState } from "react";
import { saveStorefrontAction, type StorefrontFormState } from "./actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

export function StorefrontForm({
  initial,
}: {
  initial: { announcement: string; announcementLink: string };
}) {
  const [state, action, pending] = useActionState<StorefrontFormState, FormData>(
    saveStorefrontAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-zinc-900">Message</span>
        <textarea
          name="announcement"
          defaultValue={initial.announcement}
          rows={2}
          maxLength={200}
          placeholder="e.g. 🎉 Diwali sale — 20% off everything this week!"
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-muted">
          Up to 200 characters. Leave blank to hide the bar.
        </span>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-900">Link (optional)</span>
        <input
          name="announcementLink"
          defaultValue={initial.announcementLink}
          placeholder="https://… or /store"
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-muted">
          Makes the bar clickable — link to a product, the store, or anywhere.
        </span>
      </label>
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved ✓</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
