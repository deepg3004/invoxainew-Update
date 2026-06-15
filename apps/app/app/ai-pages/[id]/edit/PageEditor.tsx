"use client";

import { useState } from "react";
import Link from "next/link";
import { GripVertical, ArrowUp, ArrowDown, Trash2, Monitor, Smartphone } from "lucide-react";
import { ImageUpload } from "@invoxai/ui";
import {
  type Block,
  type Theme,
  type ThemeTokens,
  type BuilderSeo,
  THEME_PRESETS,
  THEME_LIBRARY,
  THEME_FONTS,
  resolveTheme,
  themeCss,
  themeFontHref,
  safeUrl,
  toEmbedUrl,
} from "@invoxai/utils/blocks";

const IV_BG_OPTIONS = ["plain", "mesh", "aurora", "stars", "grid", "scan", "floats", "stripes", "blob"] as const;
const hex6 = (v: string) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : "#7c3aed");
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
  | "hero" | "pricingTable" | "featureGrid" | "stats"
  | "gallery" | "logoStrip" | "imageText"
  | "priceTag" | "limitedTag" | "marquee" | "sectionBreak"
  | "faq" | "countdown" | "columns" | "socialProof"
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
    case "hero":
      return {
        type: "hero",
        heading: "Your big headline",
        subheading: "A one-line value proposition that sells the click.",
        ctaLabel: "Get started",
        ctaHref: "",
        imageUrl: "",
      };
    case "pricingTable":
      return {
        type: "pricingTable",
        plans: [
          { name: "Starter", price: "₹0", period: "free", features: ["Feature one", "Feature two"], ctaLabel: "Choose", ctaHref: "", highlighted: false },
          { name: "Pro", price: "₹999", period: "/month", features: ["Everything in Starter", "Pro feature"], ctaLabel: "Choose", ctaHref: "", highlighted: true },
        ],
      };
    case "featureGrid":
      return {
        type: "featureGrid",
        items: [
          { icon: "⚡", title: "Fast", text: "Describe this benefit." },
          { icon: "🔒", title: "Secure", text: "Describe this benefit." },
          { icon: "💜", title: "Loved", text: "Describe this benefit." },
        ],
      };
    case "stats":
      return {
        type: "stats",
        items: [
          { value: "10k+", label: "Customers" },
          { value: "4.9★", label: "Average rating" },
          { value: "99.9%", label: "Uptime" },
        ],
      };
    case "priceTag":
      return { type: "priceTag", offer: "₹999", compareAt: "₹1,999" };
    case "limitedTag":
      return { type: "limitedTag", text: "🔥 Only a few left" };
    case "marquee":
      return { type: "marquee", items: ["★ Trusted by 10,000+", "Free updates", "30-day guarantee"] };
    case "sectionBreak":
      return { type: "sectionBreak", bg: "surface" };
    case "gallery":
      return { type: "gallery", images: [] };
    case "logoStrip":
      return { type: "logoStrip", logos: [] };
    case "imageText":
      return { type: "imageText", imageUrl: "", heading: "Section heading", text: "Describe this section.", ctaLabel: "", ctaHref: "", flip: false };
    case "faq":
      return { type: "faq", items: [{ q: "Your question?", a: "Your answer." }] };
    case "countdown":
      return {
        type: "countdown",
        until: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        label: "Offer ends in",
      };
    case "columns":
      return {
        type: "columns",
        cells: [
          { title: "Feature", text: "Describe it." },
          { title: "Feature", text: "Describe it." },
        ],
      };
    case "socialProof":
      return { type: "socialProof" };
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

/** Editor for a columns block's cells (title + text), add / edit / remove, max 4. */
function ColumnsEditor({
  cells,
  onChange,
}: {
  cells: { title: string; text: string }[];
  onChange: (cells: { title: string; text: string }[]) => void;
}) {
  const set = (idx: number, patch: Partial<{ title: string; text: string }>) =>
    onChange(cells.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-3">
      {cells.map((c, idx) => (
        <div key={idx} className="space-y-1.5 rounded-lg border border-zinc-200 p-2">
          <div className="flex gap-2">
            <input
              value={c.title}
              onChange={(e) => set(idx, { title: e.target.value })}
              placeholder={`Column ${idx + 1} title`}
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => onChange(cells.filter((_, i) => i !== idx))}
              className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-700"
              aria-label="Remove column"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <textarea
            value={c.text}
            onChange={(e) => set(idx, { text: e.target.value })}
            placeholder="Column text"
            rows={2}
            className={inputCls}
          />
        </div>
      ))}
      {cells.length < 4 ? (
        <button
          type="button"
          onClick={() => onChange([...cells, { title: "", text: "" }])}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
        >
          + Add column
        </button>
      ) : null}
    </div>
  );
}

type PricingPlan = Extract<Block, { type: "pricingTable" }>["plans"][number];

/** Editor for a pricing table's plan columns (add / edit / remove, max 4). */
function PricingEditor({
  plans,
  onChange,
}: {
  plans: PricingPlan[];
  onChange: (plans: PricingPlan[]) => void;
}) {
  const set = (idx: number, patch: Partial<PricingPlan>) =>
    onChange(plans.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  return (
    <div className="space-y-3">
      {plans.map((p, idx) => (
        <div key={idx} className="space-y-1.5 rounded-lg border border-zinc-200 p-2">
          <div className="flex gap-2">
            <input value={p.name} onChange={(e) => set(idx, { name: e.target.value })} placeholder="Plan name" className={inputCls} />
            <button
              type="button"
              onClick={() => onChange(plans.filter((_, i) => i !== idx))}
              className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-700"
              aria-label="Remove plan"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="flex gap-2">
            <input value={p.price} onChange={(e) => set(idx, { price: e.target.value })} placeholder="Price (e.g. ₹999)" className={inputCls} />
            <input value={p.period} onChange={(e) => set(idx, { period: e.target.value })} placeholder="Period (e.g. /month)" className={inputCls} />
          </div>
          <textarea
            value={p.features.join("\n")}
            onChange={(e) => set(idx, { features: e.target.value.split("\n") })}
            placeholder="One feature per line"
            rows={3}
            className={inputCls}
          />
          <div className="flex gap-2">
            <input value={p.ctaLabel} onChange={(e) => set(idx, { ctaLabel: e.target.value })} placeholder="Button label" className={inputCls} />
            <input value={p.ctaHref} onChange={(e) => set(idx, { ctaHref: e.target.value })} placeholder="https://… or /pay/your-link" className={inputCls} />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={p.highlighted} onChange={(e) => set(idx, { highlighted: e.target.checked })} />
            Highlight as “Most popular”
          </label>
        </div>
      ))}
      {plans.length < 4 ? (
        <button
          type="button"
          onClick={() => onChange([...plans, { name: "", price: "", period: "", features: [], ctaLabel: "", ctaHref: "", highlighted: false }])}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
        >
          + Add plan
        </button>
      ) : null}
    </div>
  );
}

type FeatureItem = { icon: string; title: string; text: string };

/** Editor for a feature grid's items (icon + title + text, add / edit / remove, max 6). */
function FeatureGridEditor({
  items,
  onChange,
}: {
  items: FeatureItem[];
  onChange: (items: FeatureItem[]) => void;
}) {
  const set = (idx: number, patch: Partial<FeatureItem>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  return (
    <div className="space-y-3">
      {items.map((it, idx) => (
        <div key={idx} className="space-y-1.5 rounded-lg border border-zinc-200 p-2">
          <div className="flex gap-2">
            <input value={it.icon} onChange={(e) => set(idx, { icon: e.target.value })} placeholder="Icon (emoji)" className="w-20 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand" />
            <input value={it.title} onChange={(e) => set(idx, { title: e.target.value })} placeholder="Title" className={inputCls} />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-700"
              aria-label="Remove feature"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <textarea value={it.text} onChange={(e) => set(idx, { text: e.target.value })} placeholder="Short description" rows={2} className={inputCls} />
        </div>
      ))}
      {items.length < 6 ? (
        <button
          type="button"
          onClick={() => onChange([...items, { icon: "", title: "", text: "" }])}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
        >
          + Add feature
        </button>
      ) : null}
    </div>
  );
}

type StatItem = { value: string; label: string };

/** Editor for a stats strip's items (big value + label, add / edit / remove, max 4). */
function StatsEditor({
  items,
  onChange,
}: {
  items: StatItem[];
  onChange: (items: StatItem[]) => void;
}) {
  const set = (idx: number, patch: Partial<StatItem>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  return (
    <div className="space-y-3">
      {items.map((it, idx) => (
        <div key={idx} className="flex gap-2">
          <input value={it.value} onChange={(e) => set(idx, { value: e.target.value })} placeholder="Value (e.g. 10k+)" className="w-32 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand" />
          <input value={it.label} onChange={(e) => set(idx, { label: e.target.value })} placeholder="Label" className={inputCls} />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
            className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-700"
            aria-label="Remove stat"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      {items.length < 4 ? (
        <button
          type="button"
          onClick={() => onChange([...items, { value: "", label: "" }])}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
        >
          + Add stat
        </button>
      ) : null}
    </div>
  );
}

type ImageItem = { url: string; alt: string };

/** Editor for a list of images (upload or URL + alt). Shared by gallery + logoStrip. */
function ImageListEditor({
  images,
  onChange,
  max,
  addLabel,
}: {
  images: ImageItem[];
  onChange: (images: ImageItem[]) => void;
  max: number;
  addLabel: string;
}) {
  const set = (idx: number, patch: Partial<ImageItem>) =>
    onChange(images.map((im, i) => (i === idx ? { ...im, ...patch } : im)));
  return (
    <div className="space-y-3">
      {images.map((im, idx) => (
        <div key={idx} className="space-y-1.5 rounded-lg border border-zinc-200 p-2">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <ImageUpload
                defaultValue={im.url}
                action={uploadTenantImageAction}
                onChange={(url) => set(idx, { url })}
                recommend="Upload or paste an image URL."
              />
            </div>
            <button
              type="button"
              onClick={() => onChange(images.filter((_, i) => i !== idx))}
              className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-700"
              aria-label="Remove image"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <input value={im.alt} onChange={(e) => set(idx, { alt: e.target.value })} placeholder="Alt text" className={inputCls} />
        </div>
      ))}
      {images.length < max ? (
        <button
          type="button"
          onClick={() => onChange([...images, { url: "", alt: "" }])}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
        >
          {addLabel}
        </button>
      ) : null}
      {images.length === 0 ? <p className="text-xs text-muted">No images yet — add one above.</p> : null}
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
  t: ThemeTokens;
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
    case "button": {
      const variant = block.variant ?? "primary";
      return (
        <div className="mt-4">
          <span
            className={`inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium ${
              variant === "primary" ? "iv-cta text-white" : "rounded-lg"
            }`}
            style={
              variant === "outline"
                ? { border: `1px solid ${t.accent}`, color: t.accent }
                : variant === "ghost"
                  ? { color: t.accent }
                  : undefined
            }
          >
            {block.icon ? <span>{block.icon}</span> : null}
            {block.label || "Button"}
          </span>
        </div>
      );
    }
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
    case "columns": {
      const cols = block.cells.length >= 3 ? "grid-cols-3" : block.cells.length === 2 ? "grid-cols-2" : "grid-cols-1";
      return (
        <div className={`mt-4 grid gap-2 ${cols}`}>
          {block.cells.map((c, i) => (
            <div key={i} className="rounded-lg p-2" style={{ border: `1px solid ${t.border}` }}>
              {c.title ? <div className="text-sm font-semibold" style={{ color: t.text }}>{c.title}</div> : null}
              {c.text ? <p className="mt-0.5 text-xs" style={{ color: t.muted }}>{c.text}</p> : null}
            </div>
          ))}
        </div>
      );
    }
    case "socialProof":
      return entityCard("Social proof", "Recent sales appear here automatically", "Recent sales appear here automatically");
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
          <span className="iv-cta inline-block px-5 py-2.5 text-sm font-medium text-white">
            {block.label || "Buy now"}
          </span>
          <span className="ml-2 text-xs" style={{ color: t.muted }}>
            {titleOf(entities.pages, block.pageId) ?? "pick a payment link"}
          </span>
        </div>
      );
    case "hero": {
      const img = safeUrl(block.imageUrl);
      return (
        <header className="mt-4 grid items-center gap-4 sm:grid-cols-2">
          <div>
            <div className="text-2xl font-bold tracking-tight" style={{ color: t.text }}>{block.heading || "Your headline"}</div>
            {block.subheading ? <p className="mt-2 text-sm leading-relaxed" style={{ color: t.muted }}>{block.subheading}</p> : null}
            {block.ctaLabel ? (
              <span className="mt-3 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: t.accent, opacity: block.ctaHref ? 1 : 0.5 }}>
                {block.ctaLabel}
              </span>
            ) : null}
          </div>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={block.heading} className="w-full rounded-xl object-cover" style={{ border: `1px solid ${t.border}` }} />
          ) : (
            <div className="grid h-24 place-items-center rounded-xl text-xs" style={{ border: `1px dashed ${t.border}`, color: t.muted }}>hero image — optional</div>
          )}
        </header>
      );
    }
    case "pricingTable": {
      const cols = block.plans.length >= 3 ? "grid-cols-3" : block.plans.length === 2 ? "grid-cols-2" : "grid-cols-1";
      return (
        <div className={`mt-4 grid gap-2 ${cols}`}>
          {block.plans.map((p, i) => (
            <div key={i} className="rounded-lg p-3" style={p.highlighted ? { border: `2px solid ${t.accent}`, background: `${t.accent}0A` } : { border: `1px solid ${t.border}` }}>
              <div className="text-sm font-semibold" style={{ color: t.text }}>{p.name || "Plan"}</div>
              <div className="mt-1 text-lg font-bold" style={{ color: t.text }}>{p.price || "—"}<span className="text-xs font-normal" style={{ color: t.muted }}> {p.period}</span></div>
              <ul className="mt-2 space-y-1">
                {p.features.filter(Boolean).slice(0, 4).map((f, j) => (
                  <li key={j} className="flex gap-1 text-xs" style={{ color: t.muted }}><span style={{ color: t.accent }}>✓</span>{f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    }
    case "featureGrid": {
      const cols = block.items.length >= 3 ? "grid-cols-3" : block.items.length === 2 ? "grid-cols-2" : "grid-cols-1";
      return (
        <div className={`mt-4 grid gap-2 ${cols}`}>
          {block.items.map((it, i) => (
            <div key={i} className="rounded-lg p-2" style={{ border: `1px solid ${t.border}` }}>
              {it.icon ? <div className="grid h-8 w-8 place-items-center rounded-lg text-base" style={{ background: `${t.accent}14`, color: t.accent }}>{it.icon}</div> : null}
              {it.title ? <div className="mt-1 text-sm font-semibold" style={{ color: t.text }}>{it.title}</div> : null}
              {it.text ? <p className="mt-0.5 text-xs" style={{ color: t.muted }}>{it.text}</p> : null}
            </div>
          ))}
        </div>
      );
    }
    case "stats": {
      const cols = block.items.length >= 4 ? "grid-cols-4" : block.items.length === 3 ? "grid-cols-3" : block.items.length === 2 ? "grid-cols-2" : "grid-cols-1";
      return (
        <div className={`mt-4 grid gap-2 rounded-lg p-3 ${cols}`} style={{ background: `${t.accent}0A`, border: `1px solid ${t.border}` }}>
          {block.items.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-lg font-bold tabular-nums" style={{ color: t.accent }}>{s.value || "—"}</div>
              {s.label ? <div className="text-[11px]" style={{ color: t.muted }}>{s.label}</div> : null}
            </div>
          ))}
        </div>
      );
    }
    case "gallery": {
      const imgs = block.images.map((im) => safeUrl(im.url)).filter(Boolean);
      if (imgs.length === 0) return <div className="mt-4 grid h-24 place-items-center rounded-lg text-xs" style={{ border: `1px dashed ${t.border}`, color: t.muted }}>gallery — add images</div>;
      const cols = imgs.length >= 3 ? "grid-cols-3" : imgs.length === 2 ? "grid-cols-2" : "grid-cols-1";
      return (
        <div className={`mt-4 grid gap-2 ${cols}`}>
          {imgs.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={u} alt="" className="aspect-square w-full rounded-lg object-cover" style={{ border: `1px solid ${t.border}` }} />
          ))}
        </div>
      );
    }
    case "logoStrip": {
      const imgs = block.logos.map((lg) => safeUrl(lg.url)).filter(Boolean);
      if (imgs.length === 0) return <div className="mt-4 grid h-16 place-items-center rounded-lg text-xs" style={{ border: `1px dashed ${t.border}`, color: t.muted }}>logo strip — add logos</div>;
      return (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 opacity-80">
          {imgs.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={u} alt="" className="h-7 w-auto object-contain" />
          ))}
        </div>
      );
    }
    case "imageText": {
      const img = safeUrl(block.imageUrl);
      const imgEl = img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="w-full rounded-lg object-cover" style={{ border: `1px solid ${t.border}` }} />
      ) : (
        <div className="grid h-24 place-items-center rounded-lg text-xs" style={{ border: `1px dashed ${t.border}`, color: t.muted }}>image</div>
      );
      const copy = (
        <div>
          {block.heading ? <div className="text-base font-semibold" style={{ color: t.text }}>{block.heading}</div> : null}
          {block.text ? <p className="mt-1 text-sm" style={{ color: t.muted }}>{block.text}</p> : null}
          {block.ctaLabel ? <span className="mt-2 inline-block rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: t.accent, opacity: block.ctaHref ? 1 : 0.5 }}>{block.ctaLabel}</span> : null}
        </div>
      );
      return (
        <div className="mt-4 grid items-center gap-3 sm:grid-cols-2">
          {block.flip ? (<>{copy}{imgEl}</>) : (<>{imgEl}{copy}</>)}
        </div>
      );
    }
    case "priceTag": {
      const num = (s: string) => {
        const n = Number(s.replace(/[^\d.]/g, ""));
        return Number.isFinite(n) && n > 0 ? n : null;
      };
      const o = num(block.offer);
      const c = num(block.compareAt);
      const pct = o && c && c > o ? Math.round((1 - o / c) * 100) : 0;
      return (
        <div className="mt-4 flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-bold" style={{ color: t.text }}>{block.offer || "—"}</span>
          {block.compareAt ? <span className="text-base line-through" style={{ color: t.muted }}>{block.compareAt}</span> : null}
          {pct > 0 ? <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: t.accent }}>{pct}% OFF</span> : null}
        </div>
      );
    }
    case "limitedTag":
      return (
        <div className="mt-4">
          <span className="iv-pulse inline-flex rounded-full px-3 py-1.5 text-sm font-semibold" style={{ background: `${t.accent}1A`, color: t.accent }}>
            {block.text || "Limited"}
          </span>
        </div>
      );
    case "marquee":
      return (
        <div className="iv-marquee mt-4" style={{ borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: "8px 0" }}>
          <div className="iv-marquee-track">
            {[...block.items, ...block.items].map((it, i) => (
              <span key={i} className="shrink-0 text-xs font-medium" style={{ color: t.muted }}>{it}</span>
            ))}
          </div>
        </div>
      );
    case "sectionBreak":
      return (
        <div className="my-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: t.muted }}>
          <span className="h-px flex-1" style={{ background: t.border }} />
          ◇ new section · {block.bg}
          <span className="h-px flex-1" style={{ background: t.border }} />
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

  const presetIds = THEME_LIBRARY;
  const previewTokens = resolveTheme(theme);

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
                const p = THEME_PRESETS[id]!;
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

            {/* Per-page token overrides — tweak any of the base theme's tokens. */}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-zinc-900">Customize colours &amp; fonts</summary>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["primary", "Primary"],
                      ["primary2", "Gradient end"],
                      ["text", "Text"],
                      ["surface", "Card"],
                      ["muted", "Muted"],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 text-xs text-muted">
                      <input
                        type="color"
                        value={hex6(previewTokens[k])}
                        onChange={(e) => {
                          setStatus("idle");
                          setTheme((t) => ({ ...t, overrides: { ...(t.overrides ?? {}), [k]: e.target.value } }));
                        }}
                        className="h-7 w-9 cursor-pointer rounded border border-zinc-300"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <label className="block text-xs text-muted">
                  Corner radius: {previewTokens.radius}px
                  <input
                    type="range"
                    min={0}
                    max={32}
                    value={previewTokens.radius}
                    onChange={(e) => {
                      setStatus("idle");
                      setTheme((t) => ({ ...t, overrides: { ...(t.overrides ?? {}), radius: Number(e.target.value) } }));
                    }}
                    className="mt-1 w-full"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs text-muted">
                    Heading font
                    <select
                      value={previewTokens.fontHeading}
                      onChange={(e) => {
                        setStatus("idle");
                        setTheme((t) => ({ ...t, overrides: { ...(t.overrides ?? {}), fontHeading: e.target.value } }));
                      }}
                      className={inputCls}
                    >
                      {THEME_FONTS.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-muted">
                    Body font
                    <select
                      value={previewTokens.fontBody}
                      onChange={(e) => {
                        setStatus("idle");
                        setTheme((t) => ({ ...t, overrides: { ...(t.overrides ?? {}), fontBody: e.target.value } }));
                      }}
                      className={inputCls}
                    >
                      {THEME_FONTS.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block text-xs text-muted">
                  Animated background
                  <select
                    value={previewTokens.background}
                    onChange={(e) => {
                      setStatus("idle");
                      setTheme((t) => ({
                        ...t,
                        overrides: { ...(t.overrides ?? {}), background: e.target.value as (typeof IV_BG_OPTIONS)[number] },
                      }));
                    }}
                    className={inputCls}
                  >
                    {IV_BG_OPTIONS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </label>
                {theme.overrides && Object.keys(theme.overrides).length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStatus("idle");
                      setTheme((t) => ({ ...t, overrides: {} }));
                    }}
                    className="text-xs text-red-600 underline"
                  >
                    Reset to theme defaults
                  </button>
                ) : null}
              </div>
            </details>
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
                    <div className="flex gap-2">
                      <select
                        value={b.action?.type ?? "link"}
                        onChange={(e) => {
                          const v = e.target.value;
                          update(
                            i,
                            v === "link"
                              ? { action: undefined }
                              : v === "scroll"
                                ? { action: { type: "scroll", anchor: "" } }
                                : v === "email"
                                  ? { action: { type: "email", email: "" } }
                                  : { action: { type: v as "whatsapp" | "call", phone: "" } },
                          );
                        }}
                        className={inputCls}
                      >
                        <option value="link">Open a link</option>
                        <option value="scroll">Scroll to section</option>
                        <option value="whatsapp">WhatsApp chat</option>
                        <option value="call">Phone call</option>
                        <option value="email">Send email</option>
                      </select>
                    </div>
                    {!b.action || b.action.type === "link" ? (
                      <input value={b.href} onChange={(e) => update(i, { href: e.target.value })} placeholder="https://… or /pay/your-link" className={inputCls} />
                    ) : b.action.type === "scroll" ? (
                      <input value={b.action.anchor} onChange={(e) => update(i, { action: { type: "scroll", anchor: e.target.value } })} placeholder="Section id (e.g. offer)" className={inputCls} />
                    ) : b.action.type === "email" ? (
                      <input value={b.action.email} onChange={(e) => update(i, { action: { type: "email", email: e.target.value } })} placeholder="hi@brand.com" className={inputCls} />
                    ) : (
                      <input value={b.action.phone} onChange={(e) => update(i, { action: { type: b.action!.type as "whatsapp" | "call", phone: e.target.value } })} placeholder="+91…" className={inputCls} />
                    )}
                    <div className="flex gap-2">
                      <select value={b.variant ?? "primary"} onChange={(e) => update(i, { variant: e.target.value as "primary" | "outline" | "ghost" })} className={inputCls}>
                        <option value="primary">Primary (gradient)</option>
                        <option value="outline">Outline</option>
                        <option value="ghost">Ghost</option>
                      </select>
                      <select value={b.size ?? "md"} onChange={(e) => update(i, { size: e.target.value as "sm" | "md" | "lg" })} className={inputCls}>
                        <option value="sm">Small</option>
                        <option value="md">Medium</option>
                        <option value="lg">Large</option>
                      </select>
                      <input value={b.icon ?? ""} onChange={(e) => update(i, { icon: e.target.value })} placeholder="Icon" className="w-20 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand" />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted">
                      <input type="checkbox" checked={b.fullWidth ?? false} onChange={(e) => update(i, { fullWidth: e.target.checked })} />
                      Full width
                    </label>
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

                {b.type === "hero" ? (
                  <div className="space-y-2">
                    <input value={b.heading} onChange={(e) => update(i, { heading: e.target.value })} placeholder="Headline" className={inputCls} />
                    <textarea value={b.subheading} onChange={(e) => update(i, { subheading: e.target.value })} placeholder="Sub-headline / value proposition" rows={2} className={inputCls} />
                    <div className="flex gap-2">
                      <input value={b.ctaLabel} onChange={(e) => update(i, { ctaLabel: e.target.value })} placeholder="Button label" className={inputCls} />
                      <input value={b.ctaHref} onChange={(e) => update(i, { ctaHref: e.target.value })} placeholder="https://… or /pay/your-link" className={inputCls} />
                    </div>
                    <ImageUpload
                      defaultValue={b.imageUrl}
                      action={uploadTenantImageAction}
                      onChange={(url) => update(i, { imageUrl: url })}
                      recommend="Optional hero image, shown beside the text."
                    />
                  </div>
                ) : null}

                {b.type === "pricingTable" ? (
                  <PricingEditor plans={b.plans} onChange={(plans) => update(i, { plans })} />
                ) : null}

                {b.type === "featureGrid" ? (
                  <FeatureGridEditor items={b.items} onChange={(items) => update(i, { items })} />
                ) : null}

                {b.type === "stats" ? (
                  <StatsEditor items={b.items} onChange={(items) => update(i, { items })} />
                ) : null}

                {b.type === "gallery" ? (
                  <ImageListEditor images={b.images} onChange={(images) => update(i, { images })} max={12} addLabel="+ Add image" />
                ) : null}

                {b.type === "logoStrip" ? (
                  <ImageListEditor images={b.logos} onChange={(logos) => update(i, { logos })} max={12} addLabel="+ Add logo" />
                ) : null}

                {b.type === "imageText" ? (
                  <div className="space-y-2">
                    <ImageUpload
                      defaultValue={b.imageUrl}
                      action={uploadTenantImageAction}
                      onChange={(url) => update(i, { imageUrl: url })}
                      recommend="Image shown beside the text."
                    />
                    <input value={b.heading} onChange={(e) => update(i, { heading: e.target.value })} placeholder="Heading" className={inputCls} />
                    <textarea value={b.text} onChange={(e) => update(i, { text: e.target.value })} placeholder="Body text" rows={3} className={inputCls} />
                    <div className="flex gap-2">
                      <input value={b.ctaLabel} onChange={(e) => update(i, { ctaLabel: e.target.value })} placeholder="Button label (optional)" className={inputCls} />
                      <input value={b.ctaHref} onChange={(e) => update(i, { ctaHref: e.target.value })} placeholder="https://… or /pay/your-link" className={inputCls} />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted">
                      <input type="checkbox" checked={b.flip} onChange={(e) => update(i, { flip: e.target.checked })} />
                      Image on the right
                    </label>
                  </div>
                ) : null}

                {b.type === "priceTag" ? (
                  <div className="flex gap-2">
                    <input value={b.offer} onChange={(e) => update(i, { offer: e.target.value })} placeholder="Offer price (e.g. ₹999)" className={inputCls} />
                    <input value={b.compareAt} onChange={(e) => update(i, { compareAt: e.target.value })} placeholder="Compare-at (e.g. ₹1,999)" className={inputCls} />
                  </div>
                ) : null}

                {b.type === "limitedTag" ? (
                  <input value={b.text} onChange={(e) => update(i, { text: e.target.value })} placeholder="🔥 Only 8 left" className={inputCls} />
                ) : null}

                {b.type === "marquee" ? (
                  <textarea
                    value={b.items.join("\n")}
                    onChange={(e) => update(i, { items: e.target.value.split("\n") })}
                    placeholder="One item per line"
                    rows={4}
                    className={inputCls}
                  />
                ) : null}

                {b.type === "sectionBreak" ? (
                  <label className="block text-xs text-muted">
                    Section background
                    <select value={b.bg} onChange={(e) => update(i, { bg: e.target.value as "none" | "surface" | "tint" })} className={inputCls}>
                      <option value="none">Page background</option>
                      <option value="surface">Card / white band</option>
                      <option value="tint">Accent tint</option>
                    </select>
                    <span className="mt-1 block">Blocks after this start a new full-width band with this background.</span>
                  </label>
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

                {b.type === "columns" ? (
                  <ColumnsEditor cells={b.cells} onChange={(cells) => update(i, { cells })} />
                ) : null}

                {b.type === "socialProof" ? (
                  <p className="text-xs text-muted">Automatically shows your recent sales (masked — first name + item only). Nothing to configure.</p>
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
            {(["hero", "heading", "text", "image", "button", "video", "divider", "imageText", "gallery", "logoStrip", "pricingTable", "priceTag", "limitedTag", "marquee", "sectionBreak", "featureGrid", "stats", "faq", "countdown", "columns", "socialProof"] as AddType[]).map((t) => (
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
              {/* Full theme runtime for the preview — fonts + gradient CTAs + shimmer,
                  scoped to .iv-prev so it can't touch the editor UI. */}
              <link rel="stylesheet" href={themeFontHref(previewTokens)} />
              <style dangerouslySetInnerHTML={{ __html: themeCss(previewTokens, ".iv-prev") }} />
              <div className="iv-prev max-h-[70vh] overflow-y-auto px-6 py-8" style={{ background: previewTokens.bg }}>
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
