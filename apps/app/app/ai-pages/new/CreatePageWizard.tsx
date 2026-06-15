"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { THEME_LIBRARY, THEME_PRESETS, resolveTheme } from "@invoxai/utils/blocks";
import {
  generateAiPageAction,
  createFromTemplateAction,
  type AiPageFormState,
} from "../actions";

export type TemplateOption = {
  id: string;
  name: string;
  description: string;
  preset: string;
  isPremium?: boolean;
};

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

export function CreatePageWizard({
  templates,
  aiEnabled,
  priceLabel,
  defaultPreset,
}: {
  templates: TemplateOption[];
  aiEnabled: boolean;
  priceLabel: string;
  defaultPreset: string;
}) {
  // "ai" or a template id. Default to AI when available, else the first template.
  const [start, setStart] = useState<string>(aiEnabled ? "ai" : (templates[0]?.id ?? "ai"));
  const [preset, setPreset] = useState<string>(
    THEME_PRESETS[defaultPreset] ? defaultPreset : "aurora-glow",
  );

  const isAi = start === "ai";
  const action = isAi ? generateAiPageAction : createFromTemplateAction.bind(null, start);
  const [state, formAction, pending] = useActionState<AiPageFormState, FormData>(action, {});

  const t = resolveTheme({ preset, accent: "" });

  return (
    <form action={formAction} className="space-y-10">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      {/* the seller's chosen theme rides along to the server action */}
      <input type="hidden" name="themePreset" value={preset} />

      {/* STEP 1 — Theme (required, always has a value) */}
      <section>
        <div className="mb-3 flex items-baseline gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-xs font-bold text-white">1</span>
          <h2 className="text-base font-semibold text-zinc-900">Choose a theme</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {THEME_LIBRARY.map((id) => {
            const pt = THEME_PRESETS[id]!;
            const selected = preset === id;
            return (
              <button
                type="button"
                key={id}
                onClick={() => setPreset(id)}
                className={`overflow-hidden rounded-xl border text-left transition ${
                  selected ? "border-brand ring-2 ring-brand/40" : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div className="flex h-16 items-center justify-between px-3" style={{ background: pt.bg }}>
                  <span className="text-xs font-bold" style={{ color: pt.text }}>Aa</span>
                  <span className="h-6 w-6 rounded-full" style={{ background: pt.accent }} />
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="truncate text-xs font-medium text-zinc-700">{pt.label}</span>
                  {selected ? <span className="text-xs text-brand">✓</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* STEP 2 — Starting point (AI or a template), previewed in the chosen theme */}
      <section>
        <div className="mb-3 flex items-baseline gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-xs font-bold text-white">2</span>
          <h2 className="text-base font-semibold text-zinc-900">Choose a starting point</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {aiEnabled ? (
            <button
              type="button"
              onClick={() => setStart("ai")}
              className={`rounded-xl border p-4 text-left transition ${
                isAi ? "border-brand ring-2 ring-brand/40" : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <div className="text-2xl">✨</div>
              <div className="mt-2 font-medium text-zinc-900">Generate with AI</div>
              <p className="mt-0.5 text-xs text-muted">Write a short brief and AI builds the page for you.</p>
            </button>
          ) : null}

          {templates.map((tpl) => {
            const selected = start === tpl.id;
            return (
              <button
                type="button"
                key={tpl.id}
                onClick={() => setStart(tpl.id)}
                className={`overflow-hidden rounded-xl border text-left transition ${
                  selected ? "border-brand ring-2 ring-brand/40" : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                {/* mini preview in the SELECTED theme (what it'll actually look like) */}
                <div className="px-4 py-5" style={{ background: t.bg }}>
                  <div className="text-sm font-bold" style={{ color: t.text }}>{tpl.name}</div>
                  <div className="mt-2 inline-block rounded-md px-2 py-0.5 text-[11px] font-medium text-white" style={{ background: t.accent }}>
                    Get started
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-900">{tpl.name}</span>
                    {tpl.isPremium ? (
                      <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-amber-950">Premium</span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{tpl.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* STEP 3 — Details */}
      <section>
        <div className="mb-3 flex items-baseline gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-xs font-bold text-white">3</span>
          <h2 className="text-base font-semibold text-zinc-900">Page details</h2>
        </div>

        <div className="max-w-md space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-zinc-900">Page address</span>
            <div className="mt-1 flex items-center gap-1 text-sm">
              <span className="text-muted">yoursite.invoxai.io/</span>
              <input
                name="slug"
                required
                placeholder={isAi ? "home" : "my-page"}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
              />
            </div>
            <span className="mt-1 block text-xs text-muted">Lowercase letters, digits, hyphens.</span>
          </label>

          {isAi ? (
            <>
              <label className="block">
                <span className="text-sm font-medium text-zinc-900">Business name</span>
                <input name="businessName" required placeholder="Acme Coffee Co." className={inputCls} />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-zinc-900">Brief</span>
                <textarea
                  name="brief"
                  required
                  rows={4}
                  placeholder="What you sell, who it's for, and the tone you want (e.g. friendly, premium)."
                  className={inputCls}
                />
              </label>
            </>
          ) : null}
        </div>
      </section>

      <div className="flex items-center gap-3 border-t border-zinc-100 pt-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending
            ? isAi ? "Generating…" : "Creating…"
            : isAi ? `Generate & publish — ${priceLabel}` : "Create page"}
        </button>
        <Link href="/ai-pages" className="text-sm text-muted underline">Cancel</Link>
      </div>
      {pending && isAi ? (
        <p className="text-xs text-muted">Writing your page with AI — this can take several seconds. You’re only charged if it succeeds.</p>
      ) : null}
    </form>
  );
}
