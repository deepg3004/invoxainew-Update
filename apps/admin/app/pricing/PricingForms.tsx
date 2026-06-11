"use client";

import { useActionState } from "react";
import { paiseToRupeeString } from "@invoxai/utils/money";
import { savePricingSettingAction } from "./actions";

const inputCls =
  "rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900";

/** Inline editor for one existing pricing knob — key & label fixed, value editable. */
export function PricingRow({
  settingKey,
  label,
  valuePaise,
}: {
  settingKey: string;
  label: string;
  valuePaise: number;
}) {
  const [state, formAction, pending] = useActionState(savePricingSettingAction, {});

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-0"
    >
      <input type="hidden" name="key" value={settingKey} />
      <input type="hidden" name="label" value={label} />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-neutral-900">{label}</div>
        <div className="text-xs text-neutral-400">{settingKey}</div>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-neutral-400">₹</span>
        <input
          name="value"
          inputMode="decimal"
          defaultValue={paiseToRupeeString(valuePaise)}
          className={`${inputCls} w-32`}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error ? (
        <span className="w-full text-sm text-red-700">{state.error}</span>
      ) : state.ok ? (
        <span className="w-full text-sm text-green-700">Saved.</span>
      ) : null}
    </form>
  );
}

/** Form to add a brand-new pricing knob. */
export function NewSettingForm() {
  const [state, formAction, pending] = useActionState(savePricingSettingAction, {});

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : state.ok ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Setting saved.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <input name="key" placeholder="key (e.g. ai_page_price)" className={inputCls} />
        <input name="label" placeholder="Label" className={inputCls} />
        <div className="flex items-center gap-1">
          <span className="text-neutral-400">₹</span>
          <input name="value" inputMode="decimal" placeholder="0.00" className={`${inputCls} w-full`} />
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Add setting"}
      </button>
    </form>
  );
}
