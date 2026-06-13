"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ImageUpload } from "@invoxai/ui";
import { paiseToRupeeString } from "@invoxai/utils/money";
import type { ProductKind } from "@invoxai/db";
import type { ProductFormState } from "./actions";
import { uploadTenantImageAction } from "../upload-actions";

export interface ProductValues {
  slug: string;
  title: string;
  description: string | null;
  pricePaise: number;
  compareAtPaise: number | null;
  bumpEnabled: boolean;
  bumpBlurb: string | null;
  imageUrl: string | null;
  kind: ProductKind;
  stockQty: number | null;
  sortOrder: number;
  accessUrl: string | null;
}

type Action = (prev: ProductFormState, form: FormData) => Promise<ProductFormState>;

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

const KIND_LABELS: Record<ProductKind, string> = {
  DIGITAL: "Digital",
  PHYSICAL: "Physical",
  SERVICE: "Service",
};

export function ProductForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial?: ProductValues;
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
          <span className="text-muted">/p/</span>
          <input
            name="slug"
            defaultValue={initial?.slug ?? ""}
            readOnly={isEdit}
            required={!isEdit}
            placeholder="blue-tshirt"
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
          rows={3}
          className={inputCls}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-zinc-900">Price (₹)</span>
          <input
            name="price"
            inputMode="decimal"
            defaultValue={initial ? paiseToRupeeString(initial.pricePaise) : ""}
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
            Shows struck through with a “% off” badge. Must be above the price.
          </span>
        </label>
      </div>

      <div className="block">
        <span className="text-sm font-medium text-zinc-900">Product image</span>
        <div className="mt-1.5">
          <ImageUpload
            name="imageUrl"
            defaultValue={initial?.imageUrl ?? ""}
            action={uploadTenantImageAction}
            recommend="Optional. Square or 4:3 image, ~800px, under 5 MB."
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
          Optional — a community invite (Telegram / Discord / WhatsApp) or
          download link, revealed to the buyer after they pay.
        </span>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-zinc-900">Stock</span>
          <input
            name="stockQty"
            inputMode="numeric"
            defaultValue={initial?.stockQty ?? ""}
            placeholder="Blank = unlimited"
            className={inputCls}
          />
          <span className="mt-1 block text-xs text-muted">Units, or blank.</span>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-900">Display order</span>
          <input
            name="sortOrder"
            inputMode="numeric"
            defaultValue={initial?.sortOrder ?? 0}
            className={inputCls}
          />
          <span className="mt-1 block text-xs text-muted">Lower shows first.</span>
        </label>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="bumpEnabled"
            defaultChecked={initial?.bumpEnabled ?? false}
            className="h-4 w-4"
          />
          <span className="text-sm font-medium text-zinc-900">
            Offer this product as a checkout add-on (order bump)
          </span>
        </label>
        <p className="mt-1 text-xs text-muted">
          Shown as a one-tap “add this too” at checkout on your other products and in the cart. If you
          enable it on several products, the first one is used. Tip: set a compare-at price so the
          add-on shows a deal.
        </p>
        <input
          name="bumpBlurb"
          defaultValue={initial?.bumpBlurb ?? ""}
          maxLength={140}
          placeholder="Optional pitch — e.g. “Add the bonus templates and save 50%”"
          className={`${inputCls} mt-2`}
        />
      </div>

      {!isEdit ? (
        <label className="flex items-center gap-2">
          <input type="checkbox" name="publish" className="h-4 w-4" />
          <span className="text-sm text-zinc-900">Publish to my store now</span>
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
        <Link href="/products" className="text-sm text-muted underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
