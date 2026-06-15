"use client";

import { useActionState } from "react";
import Link from "next/link";
import { paiseToRupeeString } from "@invoxai/utils/money";
import type { WorkshopFormState } from "./actions";

export interface WorkshopValues {
  slug: string;
  title: string;
  description: string | null;
  pricePaise: number;
  compareAtPaise: number | null;
  imageUrl: string | null;
  joinUrl: string | null;
  scheduledAt: Date | null;
  durationMins: number | null;
  maxSeats: number | null;
  sortOrder: number;
}

type Action = (prev: WorkshopFormState, form: FormData) => Promise<WorkshopFormState>;

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

/** Date → "YYYY-MM-DDTHH:mm" in local time for <input type="datetime-local">. */
function toLocalInput(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function WorkshopForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial?: WorkshopValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const isEdit = Boolean(initial);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}
      {state.saved ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Saved.</p>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Link</span>
        <div className="mt-1 flex items-center gap-1 text-sm">
          <span className="text-muted">/w/</span>
          <input
            name="slug"
            defaultValue={initial?.slug ?? ""}
            readOnly={isEdit}
            required={!isEdit}
            placeholder="live-masterclass"
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
        <span className="text-sm font-medium text-zinc-700">Title</span>
        <input name="title" defaultValue={initial?.title ?? ""} required placeholder="Live Masterclass" className={inputCls} />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Description</span>
        <textarea name="description" defaultValue={initial?.description ?? ""} rows={3} className={inputCls} />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Date &amp; time</span>
          <input
            type="datetime-local"
            name="scheduledAt"
            defaultValue={toLocalInput(initial?.scheduledAt ?? null)}
            className={inputCls}
          />
          <span className="mt-1 block text-xs text-muted">When the session starts (your local time).</span>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Duration (minutes)</span>
          <input name="durationMins" inputMode="numeric" defaultValue={initial?.durationMins ?? ""} placeholder="60" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Price (₹)</span>
          <input
            name="price"
            inputMode="decimal"
            defaultValue={initial && initial.pricePaise > 0 ? paiseToRupeeString(initial.pricePaise) : ""}
            placeholder="0 = free"
            className={inputCls}
          />
          <span className="mt-1 block text-xs text-muted">Leave blank or 0 for a free workshop.</span>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Compare-at price (₹)</span>
          <input
            name="compareAt"
            inputMode="decimal"
            defaultValue={initial?.compareAtPaise ? paiseToRupeeString(initial.compareAtPaise) : ""}
            placeholder="Optional — paid only"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Max seats</span>
          <input name="maxSeats" inputMode="numeric" defaultValue={initial?.maxSeats ?? ""} placeholder="Blank = unlimited" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Cover image URL</span>
          <input name="imageUrl" defaultValue={initial?.imageUrl ?? ""} placeholder="https://…/cover.jpg" className={inputCls} />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Join link (Zoom / Meet)</span>
        <input name="joinUrl" defaultValue={initial?.joinUrl ?? ""} placeholder="https://zoom.us/j/… or https://meet.google.com/…" className={inputCls} />
        <span className="mt-1 block text-xs text-muted">Revealed only to registrants after they pay.</span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Display order</span>
        <input name="sortOrder" inputMode="numeric" defaultValue={initial?.sortOrder ?? 0} className={inputCls} />
        <span className="mt-1 block text-xs text-muted">Lower shows first.</span>
      </label>

      {!isEdit ? (
        <label className="flex items-center gap-2">
          <input type="checkbox" name="publish" className="h-4 w-4" />
          <span className="text-sm text-zinc-700">Publish now</span>
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
        <Link href="/workshops" className="text-sm text-muted underline">
          {isEdit ? "Back to workshops" : "Cancel"}
        </Link>
      </div>
    </form>
  );
}
