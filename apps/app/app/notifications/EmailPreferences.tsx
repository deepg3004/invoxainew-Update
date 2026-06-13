"use client";

import { useState, useTransition } from "react";
import { setEmailPrefAction } from "./actions";

export type PrefRow = {
  key: string;
  label: string;
  description: string;
  audience: "buyer" | "seller";
  enabled: boolean;
};

export function EmailPreferences({ prefs }: { prefs: PrefRow[] }) {
  return (
    <ul className="divide-y divide-zinc-100">
      {prefs.map((p) => (
        <PrefToggle key={p.key} pref={p} />
      ))}
    </ul>
  );
}

function PrefToggle({ pref }: { pref: PrefRow }) {
  const [enabled, setEnabled] = useState(pref.enabled);
  const [pending, start] = useTransition();

  const toggle = () => {
    const next = !enabled;
    setEnabled(next); // optimistic
    start(async () => {
      try {
        await setEmailPrefAction(pref.key, next);
      } catch {
        setEnabled(!next); // revert on failure
      }
    });
  };

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900">{pref.label}</p>
        <p className="text-xs text-muted">{pref.description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${pref.label} email`}
        onClick={toggle}
        disabled={pending}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
          enabled ? "bg-brand" : "bg-zinc-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </li>
  );
}
