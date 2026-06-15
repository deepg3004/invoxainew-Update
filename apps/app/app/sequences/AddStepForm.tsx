"use client";

import { useActionState, useRef, useEffect } from "react";
import type { SequenceFormState } from "./actions";

type Action = (prev: SequenceFormState, form: FormData) => Promise<SequenceFormState>;

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

export function AddStepForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  // Clear the form after a successful add (no error returned).
  const ok = !pending && !state.error;
  useEffect(() => {
    if (ok) ref.current?.reset();
  }, [ok, state]);

  return (
    <form ref={ref} action={formAction} className="space-y-3">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Wait before sending (hours)</span>
        <input
          name="delayHours"
          inputMode="numeric"
          required
          defaultValue="0"
          placeholder="0 = immediately, 24 = next day"
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-muted">
          Measured from the previous step (or from enrolment for the first step).
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Email subject</span>
        <input name="subject" maxLength={200} placeholder="Subject line" className={inputCls} />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Message</span>
        <textarea
          name="body"
          required
          rows={4}
          maxLength={5000}
          placeholder="What this step says…"
          className={inputCls}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add step"}
      </button>
    </form>
  );
}
