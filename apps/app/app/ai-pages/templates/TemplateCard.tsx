"use client";

import { useActionState } from "react";
import { THEME_PRESETS, type ThemePreset } from "@invoxai/utils/blocks";
import { createFromTemplateAction, type AiPageFormState } from "../actions";

export function TemplateCard({
  id,
  name,
  description,
  preset,
  heroText,
}: {
  id: string;
  name: string;
  description: string;
  preset: ThemePreset;
  heroText: string;
}) {
  const action = createFromTemplateAction.bind(null, id);
  const [state, formAction, pending] = useActionState<AiPageFormState, FormData>(action, {});
  const t = THEME_PRESETS[preset];

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      {/* Mini preview using the template's theme tokens */}
      <div className="px-4 py-6" style={{ background: t.bg }}>
        <div className="text-base font-bold" style={{ color: t.text }}>
          {heroText}
        </div>
        <div className="mt-2 inline-block rounded-md px-3 py-1 text-xs font-medium text-white" style={{ background: t.accent }}>
          Get started
        </div>
      </div>

      <div className="p-4">
        <div className="font-medium text-neutral-900">{name}</div>
        <p className="mt-0.5 text-sm text-neutral-500">{description}</p>

        <form action={formAction} className="mt-3 space-y-2">
          <div className="flex items-center gap-1 text-sm">
            <span className="text-neutral-400">/</span>
            <input
              name="slug"
              required
              placeholder="my-page"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
            />
          </div>
          {state.error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Creating…" : "Use this template"}
          </button>
        </form>
      </div>
    </div>
  );
}
