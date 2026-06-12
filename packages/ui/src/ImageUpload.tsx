"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "./cn";

export type ImageUploadResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Reusable image picker used everywhere images are added (logo, favicon, product
 * image, AI-page image block, bio avatar…). Uploads the chosen file from the
 * user's computer via the supplied server `action` (which auth-gates + stores it
 * and returns a public URL), with an "or paste URL" fallback.
 *
 * Form usage: pass `name` — the resulting URL is mirrored into a hidden input so
 * it submits with the surrounding <form>. Controlled usage (no form): pass
 * `onChange` to receive the URL.
 */
export function ImageUpload({
  name,
  defaultValue = "",
  action,
  recommend,
  accept = "image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/x-icon",
  onChange,
  className,
  previewClassName,
}: {
  name?: string;
  defaultValue?: string;
  action: (fd: FormData) => Promise<ImageUploadResult>;
  recommend?: string;
  accept?: string;
  onChange?: (url: string) => void;
  className?: string;
  previewClassName?: string;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function set(next: string) {
    setUrl(next);
    onChange?.(next);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await action(fd);
      if (res.ok) set(res.url);
      else setError(res.error);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      {name ? <input type="hidden" name={name} value={url} /> : null}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50",
            previewClassName,
          )}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] text-muted">No image</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
            >
              <Upload size={14} />
              {busy ? "Uploading…" : url ? "Replace" : "Upload image"}
            </button>
            {url ? (
              <button
                type="button"
                onClick={() => set("")}
                className="inline-flex items-center gap-1 text-sm text-muted hover:text-red-700"
              >
                <X size={14} /> Remove
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowUrl((s) => !s)}
              className="text-xs text-muted underline"
            >
              {showUrl ? "hide URL" : "or paste URL"}
            </button>
          </div>
          {recommend ? <p className="mt-1 text-xs text-muted">{recommend}</p> : null}
        </div>
        <input ref={fileRef} type="file" accept={accept} onChange={onPick} className="hidden" />
      </div>
      {showUrl ? (
        <input
          value={url}
          onChange={(e) => set(e.target.value)}
          placeholder="https://…/image.png"
          className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
        />
      ) : null}
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
