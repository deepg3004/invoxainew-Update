"use client";

import { useActionState } from "react";
import Link from "next/link";
import { paiseToRupeeString } from "@invoxai/utils/money";
import type { ProductKind } from "@invoxai/db";
import type { ProductFormState } from "./actions";

export interface ProductValues {
  slug: string;
  title: string;
  description: string | null;
  pricePaise: number;
  imageUrl: string | null;
  kind: ProductKind;
  stockQty: number | null;
}

type Action = (prev: ProductFormState, form: FormData) => Promise<ProductFormState>;

const inputCls =
  "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900";

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
        <span className="text-sm font-medium text-neutral-700">Link</span>
        <div className="mt-1 flex items-center gap-1 text-sm">
          <span className="text-neutral-400">/p/</span>
          <input
            name="slug"
            defaultValue={initial?.slug ?? ""}
            readOnly={isEdit}
            required={!isEdit}
            placeholder="blue-tshirt"
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
          rows={3}
          className={inputCls}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">Price (₹)</span>
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
          <span className="text-sm font-medium text-neutral-700">Type</span>
          <select name="kind" defaultValue={initial?.kind ?? "DIGITAL"} className={inputCls}>
            {(Object.keys(KIND_LABELS) as ProductKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Image URL</span>
        <input
          name="imageUrl"
          defaultValue={initial?.imageUrl ?? ""}
          placeholder="https://…/photo.jpg"
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-neutral-400">Optional.</span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Stock</span>
        <input
          name="stockQty"
          inputMode="numeric"
          defaultValue={initial?.stockQty ?? ""}
          placeholder="Leave blank for unlimited"
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-neutral-400">
          Whole number of units, or blank for unlimited.
        </span>
      </label>

      {!isEdit ? (
        <label className="flex items-center gap-2">
          <input type="checkbox" name="publish" className="h-4 w-4" />
          <span className="text-sm text-neutral-700">Publish to my store now</span>
        </label>
      ) : null}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href="/products" className="text-sm text-neutral-500 underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
