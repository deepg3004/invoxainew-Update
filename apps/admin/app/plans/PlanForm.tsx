"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  paiseToRupeeString,
  bpsToPercentString,
} from "@invoxai/utils/money";
import type { PlanFormState } from "./actions";

export interface PlanFormValues {
  key: string;
  name: string;
  description: string | null;
  priceMonthly: number; // paise
  priceYearly: number; // paise
  commissionBps: number;
  maxProducts: number | null;
  maxAiPages: number | null;
  sortOrder: number;
}

type Action = (
  prev: PlanFormState,
  form: FormData,
) => Promise<PlanFormState>;

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-neutral-400">{hint}</span> : null}
    </label>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900";

/**
 * Create/edit form for a Plan. `initial` is undefined when creating. The `key`
 * is editable only on create (it is the stable code handle and must not change
 * once referenced).
 */
export function PlanForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial?: PlanFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const isEdit = Boolean(initial);

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <Field
        label="Key"
        hint={
          isEdit
            ? "The code key is permanent and can't be changed."
            : "Stable identifier used in code, e.g. starter. Lowercase, digits, - or _."
        }
      >
        <input
          name="key"
          defaultValue={initial?.key ?? ""}
          readOnly={isEdit}
          required={!isEdit}
          placeholder="starter"
          className={`${inputCls} ${isEdit ? "bg-neutral-100 text-neutral-500" : ""}`}
        />
      </Field>

      <Field label="Name">
        <input
          name="name"
          defaultValue={initial?.name ?? ""}
          required
          placeholder="Starter"
          className={inputCls}
        />
      </Field>

      <Field label="Description">
        <textarea
          name="description"
          defaultValue={initial?.description ?? ""}
          rows={2}
          className={inputCls}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Monthly price (₹)">
          <input
            name="priceMonthly"
            inputMode="decimal"
            defaultValue={initial ? paiseToRupeeString(initial.priceMonthly) : "0"}
            className={inputCls}
          />
        </Field>
        <Field label="Yearly price (₹)">
          <input
            name="priceYearly"
            inputMode="decimal"
            defaultValue={initial ? paiseToRupeeString(initial.priceYearly) : "0"}
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Commission (%)" hint="Platform commission on sales, 0–100.">
        <input
          name="commission"
          inputMode="decimal"
          defaultValue={initial ? bpsToPercentString(initial.commissionBps) : "0"}
          className={inputCls}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Max products" hint="Blank = unlimited.">
          <input
            name="maxProducts"
            inputMode="numeric"
            defaultValue={initial?.maxProducts ?? ""}
            placeholder="unlimited"
            className={inputCls}
          />
        </Field>
        <Field label="Max AI pages" hint="Blank = unlimited.">
          <input
            name="maxAiPages"
            inputMode="numeric"
            defaultValue={initial?.maxAiPages ?? ""}
            placeholder="unlimited"
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Sort order" hint="Lower numbers show first.">
        <input
          name="sortOrder"
          inputMode="numeric"
          defaultValue={initial?.sortOrder ?? 0}
          className={inputCls}
        />
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href="/plans" className="text-sm text-neutral-500 underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
