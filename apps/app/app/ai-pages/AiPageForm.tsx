"use client";

import { useActionState } from "react";
import Link from "next/link";
import { generateAiPageAction } from "./actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900";

export function AiPageForm({ priceLabel }: { priceLabel: string }) {
  const [state, formAction, pending] = useActionState(generateAiPageAction, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Page address</span>
        <div className="mt-1 flex items-center gap-1 text-sm">
          <span className="text-neutral-400">yoursite.invoxai.io/</span>
          <input
            name="slug"
            required
            placeholder="home"
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
          />
        </div>
        <span className="mt-1 block text-xs text-neutral-400">
          Lowercase letters, digits, hyphens.
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Business name</span>
        <input name="businessName" required placeholder="Acme Coffee Co." className={inputCls} />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Brief</span>
        <textarea
          name="brief"
          required
          rows={4}
          placeholder="What you sell, who it's for, and the tone you want (e.g. friendly, premium)."
          className={inputCls}
        />
      </label>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Generating…" : `Generate & publish — ${priceLabel}`}
        </button>
        <Link href="/ai-pages" className="text-sm text-neutral-500 underline">
          Cancel
        </Link>
      </div>
      {pending ? (
        <p className="text-xs text-neutral-400">
          Writing your page with AI — this can take several seconds. You’re only
          charged if it succeeds.
        </p>
      ) : null}
    </form>
  );
}
