"use client";

import { useActionState } from "react";
import type { PostFormState } from "./actions";

type Action = (prev: PostFormState, form: FormData) => Promise<PostFormState>;

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

export function PostForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Title</span>
        <input name="title" required placeholder="Welcome / this week's update…" className={inputCls} />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Message</span>
        <textarea name="body" rows={4} placeholder="Share an announcement with your members…" className={inputCls} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Posting…" : "Post announcement"}
      </button>
    </form>
  );
}
