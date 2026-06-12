"use client";

import { useState } from "react";
import Link from "next/link";
import {
  type Block,
  type Theme,
  type ThemePreset,
  THEME_PRESETS,
} from "@invoxai/utils/blocks";
import { saveAiPageAction } from "../../actions";

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

type AddType = Block["type"];

function newBlock(type: AddType): Block {
  switch (type) {
    case "heading":
      return { type: "heading", text: "New heading", level: 2 };
    case "text":
      return { type: "text", text: "New text" };
    case "image":
      return { type: "image", url: "", alt: "" };
    case "button":
      return { type: "button", label: "Button", href: "" };
    case "video":
      return { type: "video", url: "" };
    case "divider":
      return { type: "divider" };
  }
}

export function PageEditor({
  pageId,
  slug,
  liveUrl,
  initialTitle,
  initialBlocks,
  initialTheme,
}: {
  pageId: string;
  slug: string;
  liveUrl: string;
  initialTitle: string;
  initialBlocks: Block[];
  initialTheme: Theme;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const presetIds = Object.keys(THEME_PRESETS) as ThemePreset[];

  function update(i: number, patch: Partial<Block>) {
    setStatus("idle");
    setBlocks((bs) => bs.map((b, idx) => (idx === i ? ({ ...b, ...patch } as Block) : b)));
  }
  function move(i: number, dir: -1 | 1) {
    setStatus("idle");
    setBlocks((bs) => {
      const j = i + dir;
      if (j < 0 || j >= bs.length) return bs;
      const next = bs.slice();
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }
  function remove(i: number) {
    setStatus("idle");
    setBlocks((bs) => bs.filter((_, idx) => idx !== i));
  }
  function add(type: AddType) {
    setStatus("idle");
    setBlocks((bs) => [...bs, newBlock(type)]);
  }

  async function save() {
    setStatus("saving");
    setError(null);
    try {
      const res = await saveAiPageAction(pageId, title, blocks, theme);
      if (res.ok) setStatus("saved");
      else {
        setError(res.error);
        setStatus("idle");
      }
    } catch {
      setError("Couldn’t save. Please try again.");
      setStatus("idle");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted">
            AI builder
          </p>
          <h1 className="mt-1 text-2xl font-bold">Edit page</h1>
        </div>
        <a href={liveUrl} target="_blank" rel="noreferrer" className="text-sm text-cyan underline">
          View live ↗
        </a>
      </div>

      <label className="mt-6 block">
        <span className="text-sm font-medium text-zinc-900">Page title</span>
        <input
          value={title}
          onChange={(e) => {
            setStatus("idle");
            setTitle(e.target.value);
          }}
          className={`mt-1 ${inputCls}`}
        />
        <span className="mt-1 block text-xs text-muted">
          Lives at /{slug} on your site. Shown as the browser tab title.
        </span>
      </label>

      {/* Theme */}
      <div className="mt-6 rounded-xl border border-zinc-200 bg-surface p-4">
        <span className="text-sm font-medium text-zinc-900">Theme</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {presetIds.map((id) => {
            const p = THEME_PRESETS[id];
            const selected = theme.preset === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setStatus("idle");
                  setTheme({ preset: id, accent: p.accent });
                }}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                  selected ? "border-brand" : "border-zinc-200"
                }`}
              >
                <span
                  className="h-4 w-4 rounded-full border border-black/10"
                  style={{ background: p.bg }}
                />
                {p.label}
              </button>
            );
          })}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-muted">
          Accent
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(theme.accent) ? theme.accent : "#7c3aed"}
            onChange={(e) => {
              setStatus("idle");
              setTheme((t) => ({ ...t, accent: e.target.value }));
            }}
            className="h-7 w-10 cursor-pointer rounded border border-zinc-300"
          />
          <span className="font-mono text-xs text-muted">{theme.accent}</span>
        </label>
      </div>

      <div className="mt-6 space-y-3">
        {blocks.map((b, i) => (
          <div key={i} className="rounded-xl border border-zinc-200 bg-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                {b.type}
              </span>
              <div className="flex items-center gap-2 text-xs">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-muted disabled:opacity-30" aria-label="Move up">
                  ↑
                </button>
                <button onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="text-muted disabled:opacity-30" aria-label="Move down">
                  ↓
                </button>
                <button onClick={() => remove(i)} className="text-muted hover:text-red-700" aria-label="Delete">
                  Delete
                </button>
              </div>
            </div>

            {b.type === "heading" ? (
              <div className="flex gap-2">
                <input value={b.text} onChange={(e) => update(i, { text: e.target.value })} className={inputCls} />
                <select
                  value={b.level}
                  onChange={(e) => update(i, { level: Number(e.target.value) as 1 | 2 | 3 })}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900"
                >
                  <option value={1}>H1</option>
                  <option value={2}>H2</option>
                  <option value={3}>H3</option>
                </select>
              </div>
            ) : null}

            {b.type === "text" ? (
              <textarea value={b.text} onChange={(e) => update(i, { text: e.target.value })} rows={3} className={inputCls} />
            ) : null}

            {b.type === "image" ? (
              <div className="space-y-2">
                <input value={b.url} onChange={(e) => update(i, { url: e.target.value })} placeholder="https://…/image.jpg" className={inputCls} />
                <input value={b.alt} onChange={(e) => update(i, { alt: e.target.value })} placeholder="Alt text" className={inputCls} />
              </div>
            ) : null}

            {b.type === "button" ? (
              <div className="space-y-2">
                <input value={b.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Button label" className={inputCls} />
                <input value={b.href} onChange={(e) => update(i, { href: e.target.value })} placeholder="https://… or /pay/your-link" className={inputCls} />
              </div>
            ) : null}

            {b.type === "video" ? (
              <div>
                <input
                  value={b.url}
                  onChange={(e) => update(i, { url: e.target.value })}
                  placeholder="Paste a YouTube or Vimeo link"
                  className={inputCls}
                />
                <span className="mt-1 block text-xs text-muted">
                  Only YouTube and Vimeo links work; others are dropped on save.
                </span>
              </div>
            ) : null}

            {b.type === "divider" ? (
              <div className="border-t border-dashed border-zinc-200" />
            ) : null}
          </div>
        ))}
        {blocks.length === 0 ? (
          <p className="text-sm text-muted">No blocks yet — add one below.</p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["heading", "text", "image", "button", "video", "divider"] as AddType[]).map((t) => (
          <button
            key={t}
            onClick={() => add(t)}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
          >
            + {t}
          </button>
        ))}
      </div>

      {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={save}
          disabled={status === "saving"}
          className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save changes"}
        </button>
        <Link href="/ai-pages" className="text-sm text-muted underline">
          Back to pages
        </Link>
      </div>
    </div>
  );
}
