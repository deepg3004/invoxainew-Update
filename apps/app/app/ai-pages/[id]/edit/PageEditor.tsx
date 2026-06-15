"use client";

import { useState } from "react";
import Link from "next/link";
import { GripVertical, ArrowUp, ArrowDown, Trash2, Monitor, Smartphone } from "lucide-react";
import { ImageUpload } from "@invoxai/ui";
import {
  type Block,
  type Theme,
  type ThemePreset,
  type BuilderSeo,
  THEME_PRESETS,
  safeUrl,
  toEmbedUrl,
} from "@invoxai/utils/blocks";
import { saveAiPageAction } from "../../actions";
import { uploadTenantImageAction } from "../../../upload-actions";

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

/** The seller's catalog, passed from the server, used to populate entity-widget
 *  pickers (product/course/lead-form/payment-page/collection). */
export interface EntityOptions {
  products: { id: string; title: string }[];
  courses: { id: string; title: string }[];
  forms: { id: string; title: string }[];
  pages: { id: string; title: string }[];
  collections: { id: string; title: string }[];
}

// The block types the editor can ADD directly. The static Part-2 widgets (list,
// testimonial, callout) are still AI-authored only; Part-3 entity widgets
// (product/course/storeGrid/leadForm/paymentButton) are added + picked here.
type AddType =
  | "heading" | "text" | "image" | "button" | "video" | "divider"
  | "faq" | "countdown"
  | "product" | "course" | "storeGrid" | "leadForm" | "paymentButton";

function newBlock(type: AddType, e: EntityOptions): Block {
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
    case "faq":
      return { type: "faq", items: [{ q: "Your question?", a: "Your answer." }] };
    case "countdown":
      return {
        type: "countdown",
        until: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        label: "Offer ends in",
      };
    case "product":
      return { type: "product", productId: e.products[0]?.id ?? "" };
    case "course":
      return { type: "course", courseId: e.courses[0]?.id ?? "" };
    case "storeGrid":
      return { type: "storeGrid", collectionId: null };
    case "leadForm":
      return { type: "leadForm", formId: e.forms[0]?.id ?? "" };
    case "paymentButton":
      return { type: "paymentButton", pageId: e.pages[0]?.id ?? "", label: "Buy now" };
  }
}

const titleOf = (list: { id: string; title: string }[], id: string): string | undefined =>
  list.find((x) => x.id === id)?.title;

/** ISO ↔ <input type="datetime-local"> ("YYYY-MM-DDTHH:mm", local time). */
function isoToLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localToIso(local: string): string {
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** Editor for an FAQ block's question/answer pairs (add / edit / remove). */
function FaqEditor({
  items,
  onChange,
}: {
  items: { q: string; a: string }[];
  onChange: (items: { q: string; a: string }[]) => void;
}) {
  const set = (idx: number, patch: Partial<{ q: string; a: string }>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  return (
    <div className="space-y-3">
      {items.map((it, idx) => (
        <div key={idx} className="space-y-1.5 rounded-lg border border-zinc-200 p-2">
          <div className="flex gap-2">
            <input
              value={it.q}
              onChange={(e) => set(idx, { q: e.target.value })}
              placeholder="Question"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-700"
              aria-label="Remove question"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <textarea
            value={it.a}
            onChange={(e) => set(idx, { a: e.target.value })}
            placeholder="Answer"
            rows={2}
            className={inputCls}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { q: "", a: "" }])}
        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
      >
        + Add question
      </button>
    </div>
  );
}

/** A dropdown to pick an entity id for an entity-bound block. Shows a hint when
 *  the seller has none of that entity yet. */
function EntitySelect({
  value,
  options,
  empty,
  placeholder,
  onChange,
}: {
  value: string;
  options: { id: string; title: string }[];
  empty: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  if (options.length === 0) {
    return <p className="text-xs text-muted">{empty}</p>;
  }
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.title}</option>
      ))}
    </select>
  );
}

/**
 * Live preview of one block, mirroring the tenant renderer's markup. The editor
 * state holds RAW input (sanitization happens server-side on save), so the
 * preview runs every URL through the same safeUrl/toEmbedUrl boundaries before
 * rendering — a javascript:/data: URL never reaches preview markup either.
 * Buttons render as non-navigating <span>s: it's a preview, not a live link.
 */
function PreviewBlock({
  block,
  t,
  entities,
}: {
  block: Block;
  t: (typeof THEME_PRESETS)[ThemePreset] & { accent: string };
  entities: EntityOptions;
}) {
  // A themed placeholder card for entity widgets — the editor doesn't have live
  // price/image, so it previews the picked entity's name (resolved for real on
  // the public page). An unpicked/empty ref shows a "pick one" hint.
  const entityCard = (label: string, name: string | undefined, hint: string) => (
    <div className="mt-4 rounded-lg p-3" style={{ border: `1px solid ${t.border}` }}>
      <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: t.muted }}>{label}</div>
      <div className="mt-0.5 text-sm font-medium" style={{ color: name ? t.text : t.muted }}>{name ?? hint}</div>
    </div>
  );
  switch (block.type) {
    case "heading": {
      const cls =
        block.level === 1
          ? "text-3xl font-bold tracking-tight"
          : block.level === 2
            ? "mt-8 text-xl font-semibold"
            : "mt-5 text-base font-semibold";
      return <div className={cls} style={{ color: t.text }}>{block.text || "…"}</div>;
    }
    case "text":
      return (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed" style={{ color: t.muted }}>
          {block.text || "…"}
        </p>
      );
    case "image": {
      const url = safeUrl(block.url);
      return url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={block.alt} className="mt-4 w-full rounded-lg object-cover" style={{ border: `1px solid ${t.border}` }} />
      ) : (
        <div className="mt-4 grid h-28 place-items-center rounded-lg text-xs" style={{ border: `1px dashed ${t.border}`, color: t.muted }}>
          image — paste a URL
        </div>
      );
    }
    case "button":
      return (
        <div className="mt-4">
          <span className="inline-block rounded-lg px-5 py-2.5 text-sm font-medium text-white" style={{ background: t.accent }}>
            {block.label || "Button"}
          </span>
        </div>
      );
    case "video": {
      const url = toEmbedUrl(block.url);
      return url ? (
        <div className="mt-4 aspect-video w-full overflow-hidden rounded-lg" style={{ border: `1px solid ${t.border}` }}>
          <iframe src={url} className="h-full w-full" title="Video preview" allowFullScreen />
        </div>
      ) : (
        <div className="mt-4 grid aspect-video place-items-center rounded-lg text-xs" style={{ border: `1px dashed ${t.border}`, color: t.muted }}>
          video — paste a YouTube or Vimeo link
        </div>
      );
    }
    case "divider":
      return <hr className="mt-8" style={{ borderColor: t.border }} />;
    case "list":
      return (
        <ul className="mt-3 space-y-1.5">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed" style={{ color: t.muted }}>
              <span style={{ color: t.accent }}>•</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      );
    case "testimonial":
      return (
        <figure className="mt-5 rounded-lg p-4" style={{ background: `${t.accent}14`, border: `1px solid ${t.border}` }}>
          <blockquote className="text-sm italic" style={{ color: t.text }}>“{block.quote}”</blockquote>
          {block.author ? (
            <figcaption className="mt-2 text-xs font-medium" style={{ color: t.muted }}>— {block.author}</figcaption>
          ) : null}
        </figure>
      );
    case "callout":
      return (
        <div className="mt-4 rounded-lg border-l-4 p-3" style={{ borderColor: t.accent, background: `${t.accent}0F`, color: t.text }}>
          <p className="whitespace-pre-line text-sm">{block.text}</p>
        </div>
      );
    case "faq":
      return (
        <div className="mt-4 space-y-1.5">
          {block.items.map((it, i) => (
            <details key={i} className="rounded-lg p-3" style={{ border: `1px solid ${t.border}` }}>
              <summary className="cursor-pointer text-sm font-medium" style={{ color: t.text }}>{it.q || "Question?"}</summary>
              <p className="mt-1.5 whitespace-pre-line text-sm" style={{ color: t.muted }}>{it.a}</p>
            </details>
          ))}
        </div>
      );
    case "countdown": {
      const ms = new Date(block.until).getTime() - Date.now();
      const days = Number.isNaN(ms) ? 0 : Math.max(0, Math.floor(ms / 86_400_000));
      return (
        <div className="mt-4 rounded-lg p-3" style={{ border: `1px solid ${t.border}` }}>
          {block.label ? <div className="text-xs font-medium" style={{ color: t.muted }}>{block.label}</div> : null}
          <div className="mt-1 text-xl font-bold tabular-nums" style={{ color: t.accent }}>
            {ms <= 0 ? "Ended" : `${days}d to go`}
          </div>
        </div>
      );
    }
    case "product":
      return entityCard("Product card", titleOf(entities.products, block.productId), "Pick a product");
    case "course":
      return entityCard("Course card", titleOf(entities.courses, block.courseId), "Pick a course");
    case "storeGrid":
      return entityCard(
        "Store grid",
        block.collectionId ? `Collection: ${titleOf(entities.collections, block.collectionId) ?? "—"}` : "All published products",
        "All published products",
      );
    case "leadForm":
      return entityCard("Lead form", titleOf(entities.forms, block.formId), "Pick a form");
    case "paymentButton":
      return (
        <div className="mt-4">
          <span className="inline-block rounded-lg px-5 py-2.5 text-sm font-medium text-white" style={{ background: t.accent }}>
            {block.label || "Buy now"}
          </span>
          <span className="ml-2 text-xs" style={{ color: t.muted }}>
            {titleOf(entities.pages, block.pageId) ?? "pick a payment link"}
          </span>
        </div>
      );
  }
}

export function PageEditor({
  pageId,
  slug,
  liveUrl,
  initialTitle,
  initialBlocks,
  initialTheme,
  initialSeo,
  entities,
}: {
  pageId: string;
  slug: string;
  liveUrl: string;
  initialTitle: string;
  initialBlocks: Block[];
  initialTheme: Theme;
  initialSeo: BuilderSeo;
  entities: EntityOptions;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [seo, setSeo] = useState<BuilderSeo>(initialSeo);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const presetIds = Object.keys(THEME_PRESETS) as ThemePreset[];
  const previewTokens = { ...THEME_PRESETS[theme.preset], accent: theme.accent };

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
    setBlocks((bs) => [...bs, newBlock(type, entities)]);
  }

  /** Drop the dragged block at `to`, shifting the rest. */
  function reorder(from: number, to: number) {
    setStatus("idle");
    setBlocks((bs) => {
      if (from === to || from < 0 || from >= bs.length || to < 0 || to >= bs.length) return bs;
      const next = bs.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  }

  async function save() {
    setStatus("saving");
    setError(null);
    try {
      const res = await saveAiPageAction(pageId, title, blocks, theme, seo);
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
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted">
            AI builder
          </p>
          <h1 className="mt-1 text-2xl font-bold">Edit page</h1>
        </div>
        <a href={liveUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-strong underline">
          View live ↗
        </a>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* ── Left: controls ─────────────────────────────────────────── */}
        <div>
          <label className="block">
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

          {/* SEO — overrides the auto-derived title/description/share image. */}
          <div className="mt-6 rounded-xl border border-zinc-200 bg-surface p-4">
            <span className="text-sm font-medium text-zinc-900">SEO &amp; social sharing</span>
            <p className="mt-0.5 text-xs text-muted">Optional. Left blank, we use the page title, first paragraph, and first image.</p>
            <div className="mt-3 space-y-2">
              <label className="block">
                <span className="text-xs text-muted">Meta title (browser tab + search result)</span>
                <input
                  value={seo.metaTitle}
                  onChange={(e) => { setStatus("idle"); setSeo((s) => ({ ...s, metaTitle: e.target.value })); }}
                  maxLength={200}
                  placeholder={title || "Page title"}
                  className={`mt-1 ${inputCls}`}
                />
              </label>
              <label className="block">
                <span className="text-xs text-muted">Meta description</span>
                <textarea
                  value={seo.description}
                  onChange={(e) => { setStatus("idle"); setSeo((s) => ({ ...s, description: e.target.value })); }}
                  maxLength={300}
                  rows={2}
                  placeholder="A one-line summary shown in search results and link previews."
                  className={`mt-1 ${inputCls}`}
                />
              </label>
              <label className="block">
                <span className="text-xs text-muted">Share image URL (Open Graph)</span>
                <input
                  value={seo.ogImage}
                  onChange={(e) => { setStatus("idle"); setSeo((s) => ({ ...s, ogImage: e.target.value })); }}
                  placeholder="https://… (shown when the link is shared)"
                  className={`mt-1 ${inputCls}`}
                />
              </label>
            </div>
          </div>

          {blocks.length > 1 ? (
            <p className="mt-6 text-xs text-muted">
              Drag the <GripVertical size={12} className="inline -mt-0.5" aria-hidden /> handle to
              reorder blocks — or use the arrows.
            </p>
          ) : null}

          <div className="mt-2 space-y-3">
            {blocks.map((b, i) => (
              <div
                key={i}
                onDragOver={(e) => {
                  if (dragIndex === null) return;
                  e.preventDefault();
                  setOverIndex(i);
                }}
                onDragLeave={() => setOverIndex((o) => (o === i ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null) reorder(dragIndex, i);
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                className={`rounded-xl border bg-surface p-3 transition-shadow ${
                  overIndex === i && dragIndex !== null && dragIndex !== i
                    ? "border-brand shadow-[0_0_0_2px_rgba(236,72,153,0.25)]"
                    : "border-zinc-200"
                } ${dragIndex === i ? "opacity-50" : ""}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div
                    draggable
                    onDragStart={(e) => {
                      // Firefox refuses to start a drag unless setData is called.
                      e.dataTransfer.setData("text/plain", String(i));
                      e.dataTransfer.effectAllowed = "move";
                      setDragIndex(i);
                    }}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setOverIndex(null);
                    }}
                    className="flex cursor-grab items-center gap-1.5 active:cursor-grabbing"
                    title="Drag to reorder"
                  >
                    <GripVertical size={14} className="text-zinc-400" aria-hidden />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {b.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-muted hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30" aria-label="Move up">
                      <ArrowUp size={14} />
                    </button>
                    <button onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="rounded p-1 text-muted hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30" aria-label="Move down">
                      <ArrowDown size={14} />
                    </button>
                    <button onClick={() => remove(i)} className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-700" aria-label="Delete">
                      <Trash2 size={14} />
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
                    <ImageUpload
                      defaultValue={b.url}
                      action={uploadTenantImageAction}
                      onChange={(url) => update(i, { url })}
                      recommend="Upload or paste an image URL."
                    />
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

                {b.type === "faq" ? (
                  <FaqEditor items={b.items} onChange={(items) => update(i, { items })} />
                ) : null}

                {b.type === "countdown" ? (
                  <div className="space-y-2">
                    <input
                      value={b.label}
                      onChange={(e) => update(i, { label: e.target.value })}
                      placeholder="Label (e.g. Offer ends in)"
                      className={inputCls}
                    />
                    <input
                      type="datetime-local"
                      value={isoToLocal(b.until)}
                      onChange={(e) => update(i, { until: localToIso(e.target.value) })}
                      className={inputCls}
                    />
                    <span className="block text-xs text-muted">Counts down to this date on the live page.</span>
                  </div>
                ) : null}

                {b.type === "product" ? (
                  <EntitySelect
                    value={b.productId}
                    options={entities.products}
                    empty="You have no products yet."
                    placeholder="Select a product"
                    onChange={(v) => update(i, { productId: v })}
                  />
                ) : null}

                {b.type === "course" ? (
                  <EntitySelect
                    value={b.courseId}
                    options={entities.courses}
                    empty="You have no courses yet."
                    placeholder="Select a course"
                    onChange={(v) => update(i, { courseId: v })}
                  />
                ) : null}

                {b.type === "leadForm" ? (
                  <EntitySelect
                    value={b.formId}
                    options={entities.forms}
                    empty="You have no lead forms yet."
                    placeholder="Select a lead form"
                    onChange={(v) => update(i, { formId: v })}
                  />
                ) : null}

                {b.type === "paymentButton" ? (
                  <div className="space-y-2">
                    <input
                      value={b.label}
                      onChange={(e) => update(i, { label: e.target.value })}
                      placeholder="Button label (e.g. Buy now)"
                      className={inputCls}
                    />
                    <EntitySelect
                      value={b.pageId}
                      options={entities.pages}
                      empty="You have no payment links yet."
                      placeholder="Select a payment link"
                      onChange={(v) => update(i, { pageId: v })}
                    />
                  </div>
                ) : null}

                {b.type === "storeGrid" ? (
                  <select
                    value={b.collectionId ?? ""}
                    onChange={(e) => update(i, { collectionId: e.target.value || null })}
                    className={inputCls}
                  >
                    <option value="">All published products</option>
                    {entities.collections.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                ) : null}
              </div>
            ))}
            {blocks.length === 0 ? (
              <p className="text-sm text-muted">No blocks yet — add one below.</p>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(["heading", "text", "image", "button", "video", "divider", "faq", "countdown"] as AddType[]).map((t) => (
              <button
                key={t}
                onClick={() => add(t)}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
              >
                + {t}
              </button>
            ))}
          </div>
          {/* Entity-bound widgets — pull live items from your store/catalog. */}
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["product", "Product"],
                ["course", "Course"],
                ["storeGrid", "Store grid"],
                ["leadForm", "Lead form"],
                ["paymentButton", "Payment button"],
              ] as [AddType, string][]
            ).map(([t, label]) => (
              <button
                key={t}
                onClick={() => add(t)}
                className="rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:border-brand hover:bg-zinc-50"
              >
                + {label}
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

        {/* ── Right: live preview ────────────────────────────────────── */}
        <div className="hidden lg:block">
          <div className="sticky top-20">
            <div className="overflow-hidden rounded-xl border border-zinc-200 shadow-card">
              <div className="flex items-center gap-1.5 border-b border-zinc-200 bg-zinc-50 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-flame/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-brand/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
                <span className="ml-2 min-w-0 flex-1 truncate text-xs text-muted">/{slug} — live preview</span>
                <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-zinc-200 bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => setDevice("desktop")}
                    aria-pressed={device === "desktop"}
                    aria-label="Desktop preview"
                    title="Desktop preview"
                    className={`rounded p-1 ${device === "desktop" ? "bg-zinc-100 text-zinc-900" : "text-muted hover:text-zinc-900"}`}
                  >
                    <Monitor size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDevice("mobile")}
                    aria-pressed={device === "mobile"}
                    aria-label="Mobile preview"
                    title="Mobile preview"
                    className={`rounded p-1 ${device === "mobile" ? "bg-zinc-100 text-zinc-900" : "text-muted hover:text-zinc-900"}`}
                  >
                    <Smartphone size={14} />
                  </button>
                </div>
              </div>
              <div className="max-h-[70vh] overflow-y-auto px-6 py-8" style={{ background: previewTokens.bg }}>
                <div
                  className={`mx-auto w-full transition-[max-width] duration-200 ${
                    device === "mobile" ? "max-w-[390px]" : ""
                  }`}
                >
                  {blocks.length === 0 ? (
                    <p className="text-center text-sm" style={{ color: previewTokens.muted }}>
                      Your page preview appears here.
                    </p>
                  ) : (
                    blocks.map((b, i) => <PreviewBlock key={i} block={b} t={previewTokens} entities={entities} />)
                  )}
                  <div className="mt-12 pt-4 text-center text-xs" style={{ borderTop: `1px solid ${previewTokens.border}`, color: previewTokens.muted }}>
                    Updates as you type — save to publish changes.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
