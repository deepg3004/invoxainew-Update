"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { BroadcastSegment } from "@invoxai/db";
import type { BroadcastFormState } from "./actions";

type Action = (prev: BroadcastFormState, form: FormData) => Promise<BroadcastFormState>;

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

export interface BroadcastValues {
  name: string;
  subject: string;
  body: string;
  segment: BroadcastSegment;
}

const SEGMENT_LABEL: Record<BroadcastSegment, string> = {
  ALL: "Everyone",
  CUSTOMERS: "Customers (paid at least once)",
  LEADS: "Leads (never purchased)",
};

export function BroadcastForm({
  action,
  initial,
  counts,
  submitLabel,
}: {
  action: Action;
  initial?: BroadcastValues;
  counts: Record<BroadcastSegment, number>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [segment, setSegment] = useState<BroadcastSegment>(initial?.segment ?? "ALL");

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Name (internal)</span>
        <input
          name="name"
          defaultValue={initial?.name ?? ""}
          required
          maxLength={80}
          placeholder="June newsletter"
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-muted">Only you see this — it labels the broadcast in your list.</span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Audience</span>
        <select
          name="segment"
          value={segment}
          onChange={(e) => setSegment(e.target.value as BroadcastSegment)}
          className={inputCls}
        >
          {(Object.keys(SEGMENT_LABEL) as BroadcastSegment[]).map((s) => (
            <option key={s} value={s}>
              {SEGMENT_LABEL[s]} — {counts[s]} contact{counts[s] === 1 ? "" : "s"}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-muted">
          Goes to <strong>{counts[segment]}</strong> contact{counts[segment] === 1 ? "" : "s"} with an email on record.
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Subject</span>
        <input
          name="subject"
          defaultValue={initial?.subject ?? ""}
          required
          maxLength={150}
          placeholder="A little update from us"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Message</span>
        <textarea
          name="body"
          defaultValue={initial?.body ?? ""}
          required
          maxLength={5000}
          rows={10}
          placeholder={"Hi there,\n\nWrite your update here. Blank lines start new paragraphs.\n\n— Your name"}
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-muted">Plain text. Line breaks are preserved in the email.</span>
      </label>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href="/broadcasts" className="text-sm text-muted underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
