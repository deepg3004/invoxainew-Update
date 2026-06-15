"use client";

import { useActionState } from "react";
import Link from "next/link";
import { bpsToPercentString, formatRupees } from "@invoxai/utils/money";
import type { UpsellFormState } from "./actions";

export interface ProductOption {
  id: string;
  title: string;
  pricePaise: number;
}

export interface UpsellValues {
  offerProductId: string;
  triggerProductId: string | null;
  headline: string;
  blurb: string | null;
  discountBps: number;
}

type Action = (prev: UpsellFormState, form: FormData) => Promise<UpsellFormState>;

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

export function UpsellForm({
  action,
  products,
  initial,
  submitLabel,
}: {
  action: Action;
  products: ProductOption[];
  initial?: UpsellValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const isEdit = Boolean(initial);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Offer this product</span>
        <select
          name="offerProductId"
          defaultValue={initial?.offerProductId ?? ""}
          required
          className={inputCls}
        >
          <option value="" disabled>
            Select a product…
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} — {formatRupees(p.pricePaise)}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-muted">
          Shown to the buyer on the success page right after they pay.
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Show after buying</span>
        <select
          name="triggerProductId"
          defaultValue={initial?.triggerProductId ?? ""}
          className={inputCls}
        >
          <option value="">Any purchase</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-muted">
          Limit this offer to buyers of one product, or show it after any purchase.
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Headline</span>
        <input
          name="headline"
          defaultValue={initial?.headline ?? ""}
          required
          maxLength={120}
          placeholder="Wait! Add this at 30% off"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Description</span>
        <textarea
          name="blurb"
          defaultValue={initial?.blurb ?? ""}
          rows={3}
          maxLength={500}
          placeholder="A short pitch for the one-time offer (optional)."
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">One-time discount (%)</span>
        <input
          name="discount"
          inputMode="decimal"
          defaultValue={
            initial && initial.discountBps > 0 ? bpsToPercentString(initial.discountBps) : ""
          }
          placeholder="Leave blank for full price"
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-muted">
          Optional markdown off the offer product&apos;s price, only for this OTO.
        </span>
      </label>

      {!isEdit ? (
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked className="h-4 w-4" />
          <span className="text-sm text-zinc-700">Active immediately</span>
        </label>
      ) : null}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href="/upsells" className="text-sm text-muted underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
