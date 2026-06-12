"use client";

import { useState } from "react";
import { Button, GlassCard, PageHeader } from "@invoxai/ui";

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

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
    <div className="mx-auto max-w-6xl">
      <a href="/analytics" className="text-sm text-brand-strong underline">
        ← Analytics
      </a>
      <PageHeader
        eyebrow="InvoxAI · marketing"
        title="UTM builder"
        description="Tag a link so sales from it show up under “Top sources” in analytics."
      />

      <GlassCard className="space-y-4">
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
      </GlassCard>

      {error ? (
        <p className="mt-6 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {result ? (
        <GlassCard className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Your tagged link
          </p>
          <p className="mt-1 break-all text-sm text-brand-strong">{result}</p>
          <Button onClick={copy} size="sm" className="mt-3">
            {copied ? "Copied ✓" : "Copy link"}
          </Button>
        </GlassCard>
      ) : null}
    </div>
  );
}
