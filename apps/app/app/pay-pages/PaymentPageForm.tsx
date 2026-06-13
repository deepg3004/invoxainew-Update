"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ImageUpload } from "@invoxai/ui";
import { paiseToRupeeString } from "@invoxai/utils/money";
import type { ProductKind } from "@invoxai/db";
import type { PageFormState } from "./actions";
import { uploadTenantImageAction } from "../upload-actions";

export interface PaymentPageValues {
  slug: string;
  title: string;
  description: string | null;
  amountPaise: number;
  compareAtPaise: number | null;
  imageUrl: string | null;
  accessUrl: string | null;
  kind: ProductKind;
}

type Action = (prev: PageFormState, form: FormData) => Promise<PageFormState>;

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

const KIND_LABELS: Record<ProductKind, string> = {
  DIGITAL: "Digital",
  PHYSICAL: "Physical",
  SERVICE: "Service",
};

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
        <span className="text-sm font-medium text-zinc-900">Link</span>
        <div className="mt-1 flex items-center gap-1 text-sm">
          <span className="text-muted">/pay/</span>
          <input
            name="slug"
            defaultValue={initial?.slug ?? ""}
            readOnly={isEdit}
            required={!isEdit}
            placeholder="tshirt"
            className={`flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand ${
              isEdit ? "bg-zinc-100 text-muted" : ""
            }`}
          />
        </div>
        <span className="mt-1 block text-xs text-muted">
          {isEdit ? "The link can't be changed." : "Lowercase letters, digits, hyphens."}
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-900">Title</span>
        <input
          name="title"
          defaultValue={initial?.title ?? ""}
          required
          placeholder="Blue T-shirt"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-900">Description</span>
        <textarea
          name="description"
          defaultValue={initial?.description ?? ""}
          rows={2}
          className={inputCls}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-zinc-900">Amount (₹)</span>
          <input
            name="amount"
            inputMode="decimal"
            defaultValue={initial ? paiseToRupeeString(initial.amountPaise) : ""}
            required
            placeholder="499"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-900">Type</span>
          <select name="kind" defaultValue={initial?.kind ?? "DIGITAL"} className={inputCls}>
            {(Object.keys(KIND_LABELS) as ProductKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-900">Compare-at price (₹)</span>
          <input
            name="compareAt"
            inputMode="decimal"
            defaultValue={initial?.compareAtPaise ? paiseToRupeeString(initial.compareAtPaise) : ""}
            placeholder="Optional — e.g. 999"
            className={inputCls}
          />
          <span className="mt-1 block text-xs text-muted">
            Shows struck through with a “% off” badge. Must be above the amount.
          </span>
        </label>
      </div>

      <div className="block">
        <span className="text-sm font-medium text-zinc-900">Image</span>
        <div className="mt-1.5">
          <ImageUpload
            name="imageUrl"
            defaultValue={initial?.imageUrl ?? ""}
            action={uploadTenantImageAction}
            recommend="Optional banner shown on the payment page. ~800px, under 5 MB."
          />
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-zinc-900">Access link</span>
        <input
          name="accessUrl"
          defaultValue={initial?.accessUrl ?? ""}
          placeholder="https://t.me/… or download URL"
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-muted">
          Optional — a community invite or download link, revealed to the buyer after they pay.
        </span>
      </label>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href="/pay-pages" className="text-sm text-muted underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
