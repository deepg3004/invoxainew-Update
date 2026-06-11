"use client";

import { useActionState } from "react";
import Link from "next/link";
import { paiseToRupeeString } from "@invoxai/utils/money";
import type { PageFormState } from "./actions";

export interface PaymentPageValues {
  slug: string;
  title: string;
  description: string | null;
  amountPaise: number;
}

type Action = (prev: PageFormState, form: FormData) => Promise<PageFormState>;

const inputCls =
  "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900";

export function PaymentPageForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial?: PaymentPageValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const isEdit = Boolean(initial);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Link</span>
        <div className="mt-1 flex items-center gap-1 text-sm">
          <span className="text-neutral-400">/pay/</span>
          <input
            name="slug"
            defaultValue={initial?.slug ?? ""}
            readOnly={isEdit}
            required={!isEdit}
            placeholder="tshirt"
            className={`flex-1 rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900 ${
              isEdit ? "bg-neutral-100 text-neutral-500" : ""
            }`}
          />
        </div>
        <span className="mt-1 block text-xs text-neutral-400">
          {isEdit ? "The link can't be changed." : "Lowercase letters, digits, hyphens."}
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Title</span>
        <input
          name="title"
          defaultValue={initial?.title ?? ""}
          required
          placeholder="Blue T-shirt"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Description</span>
        <textarea
          name="description"
          defaultValue={initial?.description ?? ""}
          rows={2}
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Amount (₹)</span>
        <input
          name="amount"
          inputMode="decimal"
          defaultValue={initial ? paiseToRupeeString(initial.amountPaise) : ""}
          required
          placeholder="499"
          className={inputCls}
        />
      </label>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href="/pay-pages" className="text-sm text-neutral-500 underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
