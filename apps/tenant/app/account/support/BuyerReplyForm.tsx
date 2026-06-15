"use client";

import { useActionState, useRef, useEffect } from "react";
import type { SupportState } from "./actions";

type Action = (prev: SupportState, form: FormData) => Promise<SupportState>;

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

/** Shared form for opening a ticket (with subject) or replying (body only). */
export function BuyerReplyForm({
  action,
  withSubject,
  submitLabel,
}: {
  action: Action;
  withSubject?: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  const ok = !pending && !state.error;
  useEffect(() => {
    if (ok && !withSubject) ref.current?.reset();
  }, [ok, state, withSubject]);

  return (
    <form ref={ref} action={formAction} className="space-y-2">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}
      {withSubject ? (
        <input name="subject" required maxLength={150} placeholder="Subject" className={inputCls} />
      ) : null}
      <textarea
        name="body"
        required
        rows={4}
        maxLength={5000}
        placeholder="How can the seller help?"
        className={inputCls}
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Sending…" : submitLabel}
      </button>
    </form>
  );
}
