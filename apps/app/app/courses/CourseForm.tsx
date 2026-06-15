"use client";

import { useActionState } from "react";
import Link from "next/link";
import { paiseToRupeeString } from "@invoxai/utils/money";
import type { CourseFormState } from "./actions";

export interface CourseValues {
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  learnPoints: string[];
  requirements: string[];
  pricePaise: number;
  compareAtPaise: number | null;
  imageUrl: string | null;
  sortOrder: number;
  certificateEnabled: boolean;
}

type Action = (prev: CourseFormState, form: FormData) => Promise<CourseFormState>;

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

export function CourseForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial?: CourseValues;
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
          <span className="text-muted">/c/</span>
          <input
            name="slug"
            defaultValue={initial?.slug ?? ""}
            readOnly={isEdit}
            required={!isEdit}
            placeholder="react-basics"
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
        <input
          name="title"
          defaultValue={initial?.title ?? ""}
          required
          placeholder="React for Beginners"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Subtitle</span>
        <input
          name="subtitle"
          defaultValue={initial?.subtitle ?? ""}
          placeholder="A short one-line pitch shown under the title"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Description</span>
        <textarea
          name="description"
          defaultValue={initial?.description ?? ""}
          rows={3}
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">What you'll learn</span>
        <textarea
          name="learnPoints"
          defaultValue={initial?.learnPoints.join("\n") ?? ""}
          rows={4}
          placeholder="One outcome per line, e.g.&#10;Build a React app from scratch&#10;Deploy to production"
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-muted">One bullet per line. Shown as a checklist on the course page.</span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Requirements</span>
        <textarea
          name="requirements"
          defaultValue={initial?.requirements.join("\n") ?? ""}
          rows={3}
          placeholder="One requirement per line, e.g.&#10;Basic JavaScript&#10;A laptop"
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-muted">One per line. Optional.</span>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Price (₹)</span>
          <input
            name="price"
            inputMode="decimal"
            defaultValue={initial ? paiseToRupeeString(initial.pricePaise) : ""}
            required
            placeholder="999"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Cover image URL</span>
          <input
            name="imageUrl"
            defaultValue={initial?.imageUrl ?? ""}
            placeholder="https://…/cover.jpg"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Compare-at price (₹)</span>
          <input
            name="compareAt"
            inputMode="decimal"
            defaultValue={initial?.compareAtPaise ? paiseToRupeeString(initial.compareAtPaise) : ""}
            placeholder="Optional — e.g. 1999"
            className={inputCls}
          />
          <span className="mt-1 block text-xs text-muted">
            Shows struck through with a “% off” badge. Must be above the price.
          </span>
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Display order</span>
        <input
          name="sortOrder"
          inputMode="numeric"
          defaultValue={initial?.sortOrder ?? 0}
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-muted">Lower shows first.</span>
      </label>

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          name="certificateEnabled"
          defaultChecked={initial?.certificateEnabled ?? false}
          className="mt-0.5 h-4 w-4"
        />
        <span className="text-sm text-zinc-700">
          Issue a completion certificate
          <span className="mt-0.5 block text-xs text-muted">
            Learners who finish every lesson automatically get a shareable, verifiable certificate.
          </span>
        </span>
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
        <Link href="/courses" className="text-sm text-muted underline">
          {isEdit ? "Back to courses" : "Cancel"}
        </Link>
      </div>
    </form>
  );
}
