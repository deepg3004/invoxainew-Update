"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { LessonFormState } from "./actions";

export interface LessonValues {
  title: string;
  content: string | null;
  isPreview: boolean;
  sortOrder: number;
}

type Action = (prev: LessonFormState, form: FormData) => Promise<LessonFormState>;

const inputCls =
  "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900";

export function LessonForm({
  action,
  initial,
  submitLabel,
  courseId,
}: {
  action: Action;
  initial?: LessonValues;
  submitLabel: string;
  courseId: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const isEdit = Boolean(initial);

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">Lesson title</span>
          <input
            name="title"
            defaultValue={initial?.title ?? ""}
            required
            placeholder="Introduction"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">Order</span>
          <input
            name="sortOrder"
            inputMode="numeric"
            defaultValue={initial?.sortOrder ?? 0}
            className={inputCls}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Content</span>
        <textarea
          name="content"
          defaultValue={initial?.content ?? ""}
          rows={isEdit ? 10 : 4}
          placeholder="Lesson text. (Video uploads come later.)"
          className={inputCls}
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="isPreview"
          defaultChecked={initial?.isPreview ?? false}
          className="h-4 w-4"
        />
        <span className="text-sm text-neutral-700">
          Free preview (visible before buying)
        </span>
      </label>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {isEdit ? (
          <Link href={`/courses/${courseId}`} className="text-sm text-neutral-500 underline">
            Cancel
          </Link>
        ) : null}
      </div>
    </form>
  );
}
