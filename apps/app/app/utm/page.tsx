"use client";

import { useState } from "react";

const inputCls =
  "mt-1 w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

const FIELDS = [
  { key: "utm_source", label: "Source", placeholder: "instagram, newsletter, google" },
  { key: "utm_medium", label: "Medium", placeholder: "social, email, cpc" },
  { key: "utm_campaign", label: "Campaign", placeholder: "spring_sale" },
  { key: "utm_content", label: "Content (optional)", placeholder: "story_link" },
  { key: "utm_term", label: "Term (optional)", placeholder: "running+shoes" },
] as const;

export default function UtmBuilderPage() {
  const [base, setBase] = useState("");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  let result = "";
  let error = "";
  const trimmed = base.trim();
  if (trimmed) {
    try {
      const url = new URL(trimmed);
      for (const f of FIELDS) {
        const v = vals[f.key]?.trim();
        if (v) url.searchParams.set(f.key, v);
      }
      result = url.toString();
    } catch {
      error = "Enter a full URL including https://";
    }
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <a href="/analytics" className="text-sm text-cyan underline">
        ← Analytics
      </a>
      <h1 className="mt-3 text-3xl font-bold">UTM builder</h1>
      <p className="mt-2 text-muted">
        Tag a link so sales from it show up under “Top sources” in analytics.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium">Destination URL</label>
          <input
            value={base}
            onChange={(e) => setBase(e.target.value)}
            placeholder="https://you.invoxai.io/store"
            className={inputCls}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="text-sm font-medium">{f.label}</label>
              <input
                value={vals[f.key] ?? ""}
                onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-6 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Your tagged link
          </p>
          <p className="mt-1 break-all text-sm text-cyan">{result}</p>
          <button
            onClick={copy}
            className="mt-3 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-glow"
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
