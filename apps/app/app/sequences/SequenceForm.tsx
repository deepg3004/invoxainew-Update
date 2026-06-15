"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { SequenceTrigger } from "@invoxai/db";
import type { SequenceFormState } from "./actions";

export interface ProductOption {
  id: string;
  title: string;
}

export interface SequenceValues {
  name: string;
  trigger: SequenceTrigger;
  triggerProductId: string | null;
}

type Action = (prev: SequenceFormState, form: FormData) => Promise<SequenceFormState>;

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

const TRIGGER_HELP: Record<SequenceTrigger, string> = {
  PURCHASE: "Enrols a buyer when they complete a paid order.",
  LEAD: "Enrols someone when they submit one of your lead forms.",
  MANUAL: "You add contacts to this sequence yourself.",
};

export function SequenceForm({
  action,
  products,
  initial,
  submitLabel,
}: {
  action: Action;
  products: ProductOption[];
  initial?: SequenceValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [trigger, setTrigger] = useState<SequenceTrigger>(initial?.trigger ?? "PURCHASE");

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Name</span>
        <input
          name="name"
          defaultValue={initial?.name ?? ""}
          required
          maxLength={80}
          placeholder="Post-purchase onboarding"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Trigger</span>
        <select
          name="trigger"
          value={trigger}
          onChange={(e) => setTrigger(e.target.value as SequenceTrigger)}
          className={inputCls}
        >
          <option value="PURCHASE">After a purchase</option>
          <option value="LEAD">After a lead form submission</option>
          <option value="MANUAL">Manual</option>
        </select>
        <span className="mt-1 block text-xs text-muted">{TRIGGER_HELP[trigger]}</span>
      </label>

      {trigger === "PURCHASE" ? (
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Limit to product (optional)</span>
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
        <Link href="/sequences" className="text-sm text-muted underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
