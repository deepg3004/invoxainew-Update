"use client";

import { useActionState } from "react";
import { saveTemplateAction, type TemplateFormState } from "./actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

export type EditorEvent = {
  key: string;
  label: string;
  description: string;
  audience: "buyer" | "seller";
  variables: string[];
  subject: string;
  body: string;
  customized: boolean;
};

export function TemplatesEditor({ events }: { events: EditorEvent[] }) {
  return (
    <div className="space-y-6">
      {events.map((e) => (
        <EventTemplateForm key={e.key} event={e} />
      ))}
    </div>
  );
}

function EventTemplateForm({ event }: { event: EditorEvent }) {
  const [state, action, pending] = useActionState<TemplateFormState, FormData>(
    saveTemplateAction,
    {},
  );
  const saved = state.ok && state.savedKey === event.key;

  return (
    <form
      action={action}
      className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-card"
    >
      <input type="hidden" name="eventKey" value={event.key} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">{event.label}</h2>
          <p className="mt-1 text-sm text-muted">{event.description}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            event.audience === "buyer"
              ? "bg-violet-50 text-violet-700"
              : "bg-pink-50 text-pink-700"
          }`}
        >
          {event.audience === "buyer" ? "To buyer" : "To seller"}
        </span>
      </div>

      <label className="mt-5 block">
        <span className="text-sm font-medium text-zinc-900">Subject</span>
        <input name="subject" defaultValue={event.subject} className={inputCls} maxLength={200} />
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-zinc-900">Message</span>
        <textarea
          name="body"
          defaultValue={event.body}
          rows={3}
          className={`${inputCls} resize-y`}
          maxLength={2000}
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted">Variables:</span>
        {event.variables.map((v) => (
          <code
            key={v}
            className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700"
          >{`{{${v}}}`}</code>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save template"}
        </button>
        {saved ? <span className="text-sm text-emerald-600">Saved ✓</span> : null}
        {!event.customized && !saved ? (
          <span className="text-xs text-muted">Currently using the default.</span>
        ) : null}
        {state.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
      </div>
    </form>
  );
}
