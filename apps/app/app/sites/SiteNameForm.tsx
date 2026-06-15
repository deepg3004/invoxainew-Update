"use client";

import { useActionState } from "react";
import type { SiteFormState } from "./actions";

type Action = (prev: SiteFormState, form: FormData) => Promise<SiteFormState>;

export function SiteNameForm({
  action,
  initialName,
  submitLabel,
  placeholder,
}: {
  action: Action;
  initialName?: string;
  submitLabel: string;
  placeholder?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-wrap items-start gap-2">
      <div className="flex-1">
        <input
          name="name"
          defaultValue={initialName ?? ""}
          required
          maxLength={80}
          placeholder={placeholder ?? "Site name"}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
        />
        {state.error ? <p className="mt-1 text-xs text-red-600">{state.error}</p> : null}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
