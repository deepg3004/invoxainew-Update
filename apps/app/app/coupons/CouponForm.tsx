"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  paiseToRupeeString,
  bpsToPercentString,
} from "@invoxai/utils/money";
import type { DiscountType } from "@invoxai/db";
import type { CouponFormState } from "./actions";

export interface CouponValues {
  code: string;
  type: DiscountType;
  value: number; // PERCENT → bps; FLAT → paise
  minSubtotalPaise: number | null;
  maxRedemptions: number | null;
  startsAt: string | null; // datetime-local value
  expiresAt: string | null;
}

type Action = (prev: CouponFormState, form: FormData) => Promise<CouponFormState>;

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

export function CouponForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial?: CouponValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const isEdit = Boolean(initial);
  const [type, setType] = useState<DiscountType>(initial?.type ?? "PERCENT");

  // For edit, render value back in the unit the input expects (% or ₹).
  const initialValue =
    initial == null
      ? ""
      : initial.type === "PERCENT"
        ? bpsToPercentString(initial.value)
        : paiseToRupeeString(initial.value);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Code</span>
        <input
          name="code"
          defaultValue={initial?.code ?? ""}
          readOnly={isEdit}
          required={!isEdit}
          placeholder="SAVE10"
          onChange={(e) => {
            e.target.value = e.target.value.toUpperCase();
          }}
          className={`mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 uppercase text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand ${
            isEdit ? "bg-zinc-100 text-muted" : ""
          }`}
        />
        <span className="mt-1 block text-xs text-muted">
          {isEdit
            ? "The code can't be changed — deactivate and create a new one instead."
            : "Buyers type this at checkout. Letters, digits, hyphens."}
        </span>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Type</span>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as DiscountType)}
            className={inputCls}
          >
            <option value="PERCENT">Percent off</option>
            <option value="FLAT">Flat amount off</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">
            {type === "PERCENT" ? "Discount (%)" : "Discount (₹)"}
          </span>
          <input
            name="value"
            inputMode="decimal"
            defaultValue={initialValue}
            required
            placeholder={type === "PERCENT" ? "10" : "100"}
            className={inputCls}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">
          Minimum order (₹)
        </span>
        <input
          name="minSubtotal"
          inputMode="decimal"
          defaultValue={
            initial?.minSubtotalPaise != null
              ? paiseToRupeeString(initial.minSubtotalPaise)
              : ""
          }
          placeholder="Leave blank for no minimum"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Usage limit</span>
        <input
          name="maxRedemptions"
          inputMode="numeric"
          defaultValue={initial?.maxRedemptions ?? ""}
          placeholder="Leave blank for unlimited"
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-muted">
          Total number of times this code can be redeemed.
        </span>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Starts</span>
          <input
            type="datetime-local"
            name="startsAt"
            defaultValue={initial?.startsAt ?? ""}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Expires</span>
          <input
            type="datetime-local"
            name="expiresAt"
            defaultValue={initial?.expiresAt ?? ""}
            className={inputCls}
          />
        </label>
      </div>

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
        <Link href="/coupons" className="text-sm text-muted underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
