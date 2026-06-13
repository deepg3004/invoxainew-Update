"use client";

import { useActionState } from "react";
import { submitAbuseReport, type ReportState } from "./actions";

const REASONS = [
  { value: "fraud", label: "Scam or fraud" },
  { value: "prohibited", label: "Prohibited or illegal goods" },
  { value: "offensive", label: "Offensive or harmful content" },
  { value: "spam", label: "Spam or misleading" },
  { value: "other", label: "Something else" },
];

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";

export function ReportForm() {
  const [state, action, pending] = useActionState<ReportState, FormData>(submitAbuseReport, {});

  if (state.ok) {
    return (
      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
        Thanks — your report has been sent to InvoxAI’s safety team. We review every report and
        take action where needed. You can close this page.
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-zinc-900">Reason</span>
        <select name="reason" defaultValue="" className={inputCls} required>
          <option value="" disabled>
            Choose a reason…
          </option>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-900">Details (optional)</span>
        <textarea
          name="detail"
          rows={4}
          maxLength={2000}
          placeholder="What happened? Add any links or specifics that would help us review."
          className={`${inputCls} resize-y`}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-900">Your email (optional)</span>
        <input
          name="email"
          type="email"
          placeholder="So we can follow up if needed"
          className={inputCls}
        />
      </label>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Submit report"}
      </button>
    </form>
  );
}
