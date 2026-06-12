"use client";

import { useActionState } from "react";
import { addDomainAction } from "./actions";

export function AddDomainForm() {
  const [state, formAction, pending] = useActionState(addDomainAction, {});
  return (
    <form action={formAction} className="space-y-2">
      <div className="flex gap-2">
        <input
          name="domain"
          placeholder="shop.example.com"
          required
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add domain"}
        </button>
      </div>
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}
    </form>
  );
}
