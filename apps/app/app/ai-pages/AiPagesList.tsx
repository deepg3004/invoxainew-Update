"use client";

import { useState } from "react";
import Link from "next/link";
import { GlassCard } from "@invoxai/ui";
import { CopyLinkButton } from "../components/CopyLinkButton";
import { deleteAiPageAction, setAiPagePublishedAction, renameAiPageAction } from "./actions";

type Row = { id: string; slug: string; title: string; isPublished: boolean };

/** AI-pages list with a search box (title/slug) + inline rename. Server actions
 *  (publish/delete/rename) are imported directly and used as form actions. */
export function AiPagesList({ pages, base }: { pages: Row[]; base: string }) {
  const [q, setQ] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? pages.filter((p) => p.title.toLowerCase().includes(needle) || p.slug.toLowerCase().includes(needle))
    : pages;

  return (
    <div className="mt-6">
      {pages.length > 1 ? (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search pages by title or address…"
          className="mb-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
        />
      ) : null}

      {shown.length === 0 ? (
        <GlassCard className="text-muted">No pages match “{q}”.</GlassCard>
      ) : (
        <div className="space-y-3">
          {shown.map((p) => {
            const url = `${base}/${p.slug}`;
            return (
              <GlassCard key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {renaming === p.id ? (
                      <form
                        action={async (fd) => {
                          await renameAiPageAction(p.id, fd);
                          setRenaming(null);
                        }}
                        className="flex items-center gap-2"
                      >
                        <input
                          name="title"
                          defaultValue={p.title}
                          autoFocus
                          maxLength={200}
                          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-brand"
                        />
                        <button className="text-sm font-medium text-brand-strong underline">Save</button>
                        <button type="button" onClick={() => setRenaming(null)} className="text-sm text-muted underline">
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-900">{p.title}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.isPublished ? "bg-green-50 text-green-700" : "bg-zinc-100 text-muted"
                          }`}
                        >
                          {p.isPublished ? "Published" : "Hidden"}
                        </span>
                      </div>
                    )}
                    {p.isPublished ? (
                      <a href={url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm text-brand-strong underline">
                        {url}
                      </a>
                    ) : (
                      <span className="mt-1 block truncate text-sm text-muted">/{p.slug}</span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-sm">
                    {p.isPublished ? <CopyLinkButton url={url} /> : null}
                    <button onClick={() => setRenaming(p.id)} className="text-muted underline hover:text-zinc-900">
                      Rename
                    </button>
                    <Link href={`/ai-pages/${p.id}/edit`} className="text-brand-strong underline">
                      Edit
                    </Link>
                    <form action={setAiPagePublishedAction.bind(null, p.id, !p.isPublished)}>
                      <button className="text-muted underline hover:text-zinc-900">
                        {p.isPublished ? "Unpublish" : "Publish"}
                      </button>
                    </form>
                    <form action={deleteAiPageAction.bind(null, p.id)}>
                      <button className="text-muted underline hover:text-red-700">Delete</button>
                    </form>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
