"use client";

import { useActionState, useRef, useEffect } from "react";
import type { SupportReplyState } from "./actions";

type Action = (prev: SupportReplyState, form: FormData) => Promise<SupportReplyState>;

export function ReplyForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  const ok = !pending && !state.error;
  useEffect(() => {
    if (ok) ref.current?.reset();
  }, [ok, state]);

  return (
    <form ref={ref} action={formAction} className="space-y-2">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}
      <textarea
        name="body"
        required
        rows={4}
        maxLength={5000}
        placeholder="Write a reply…"
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send reply"}
      </button>
    </form>
  );
}
