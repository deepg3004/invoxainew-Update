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
  isPremium = false,
  category,
}: {
  id: string;
  name: string;
  description: string;
  preset: ThemePreset;
  heroText: string;
  isPremium?: boolean;
  category?: string;
}) {
  const action = createFromTemplateAction.bind(null, id);
  const [state, formAction, pending] = useActionState<AiPageFormState, FormData>(action, {});
  const t = THEME_PRESETS[preset];

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-surface">
      {/* Mini preview using the template's theme tokens */}
      <div className="relative px-4 py-6" style={{ background: t.bg }}>
        {isPremium ? (
          <span className="absolute right-3 top-3 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
            Premium
          </span>
        ) : null}
        <div className="text-base font-bold" style={{ color: t.text }}>
          {heroText}
        </div>
        <div className="mt-2 inline-block rounded-md px-3 py-1 text-xs font-medium text-white" style={{ background: t.accent }}>
          Get started
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium text-zinc-900">{name}</div>
          {category ? (
            <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
              {category}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-muted">{description}</p>

        <form action={formAction} className="mt-3 space-y-2">
          <div className="flex items-center gap-1 text-sm">
            <span className="text-muted">/</span>
            <input
              name="slug"
              required
              placeholder="my-page"
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
            />
          </div>
          {state.error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Creating…" : "Use this template"}
          </button>
        </form>
      </div>
    </div>
  );
}
