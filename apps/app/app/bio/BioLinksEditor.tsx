"use client";

import { useState } from "react";
import { GripVertical, Trash2, Plus } from "lucide-react";

type Item = { label: string; url: string };

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

// Parse / serialize the legacy "Label | https://url" line format, so the public
// renderer, click tracking and the /bio/r redirect allowlist stay unchanged.
function parse(text: string): Item[] {
  return text
    .split("\n")
    .map((line) => {
      const i = line.indexOf("|");
      return {
        label: (i === -1 ? line : line.slice(0, i)).trim(),
        url: (i === -1 ? "" : line.slice(i + 1)).trim(),
      };
    })
    .filter((it) => it.label || it.url);
}
function serialize(items: Item[]): string {
  return items
    .map((it) => ({ label: it.label.replace(/\|/g, "").trim(), url: it.url.replace(/\|/g, "").trim() }))
    .filter((it) => it.label || it.url)
    .map((it) => `${it.label} | ${it.url}`)
    .join("\n");
}

/** Structured, drag-reorderable bio links. Mirrors state into a hidden input
 *  named `name` (the legacy linksText format), so it submits with the bio form. */
export function BioLinksEditor({ name, defaultValue = "" }: { name: string; defaultValue?: string }) {
  const [items, setItems] = useState<Item[]>(parse(defaultValue));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const update = (i: number, patch: Partial<Item>) =>
    setItems((its) => its.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => setItems((its) => its.filter((_, idx) => idx !== i));
  const add = () => setItems((its) => [...its, { label: "", url: "" }]);
  function reorder(from: number, to: number) {
    setItems((its) => {
      if (from === to || from < 0 || to < 0 || from >= its.length || to >= its.length) return its;
      const next = its.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  }

  return (
    <div>
      <label className="text-sm font-medium">Links</label>
      <p className="text-xs text-muted">Buttons shown on your bio page. Drag the handle to reorder.</p>
      <input type="hidden" name={name} value={serialize(items)} />

      <div className="mt-2 space-y-2">
        {items.map((it, i) => (
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
            className={`flex items-center gap-2 rounded-lg border p-2 transition-shadow ${
              overIndex === i && dragIndex !== null && dragIndex !== i
                ? "border-brand shadow-[0_0_0_2px_rgba(236,72,153,0.25)]"
                : "border-zinc-200"
            } ${dragIndex === i ? "opacity-50" : ""}`}
          >
            <span
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", String(i));
                e.dataTransfer.effectAllowed = "move";
                setDragIndex(i);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              className="cursor-grab text-zinc-400 active:cursor-grabbing"
              title="Drag to reorder"
            >
              <GripVertical size={16} />
            </span>
            <input
              value={it.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Label (e.g. My store)"
              className={`${inputCls} max-w-[40%]`}
            />
            <input
              value={it.url}
              onChange={(e) => update(i, { url: e.target.value })}
              placeholder="https://…"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove link"
              className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {items.length === 0 ? (
          <p className="text-sm text-muted">No links yet — add one below.</p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={add}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        <Plus size={14} /> Add link
      </button>
    </div>
  );
}
