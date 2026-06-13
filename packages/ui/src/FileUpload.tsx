"use client";

import { useRef, useState } from "react";
import { Upload, X, FileDown } from "lucide-react";
import { cn } from "./cn";

export type FileUploadResult =
  | { ok: true; key: string; name: string }
  | { ok: false; error: string };

/**
 * Upload a digital file (any type) to PRIVATE storage via the supplied server
 * `action` (which auth-gates + stores it and returns an opaque object key + the
 * original filename). The key + name are mirrored into two hidden inputs so they
 * submit with the surrounding <form>. The key is never a public URL — the file is
 * delivered to buyers only via a signed URL after they pay.
 */
export function FileUpload({
  keyName,
  nameName,
  defaultKey = "",
  defaultName = "",
  action,
  recommend,
  className,
}: {
  keyName: string;
  nameName: string;
  defaultKey?: string;
  defaultName?: string;
  action: (fd: FormData) => Promise<FileUploadResult>;
  recommend?: string;
  className?: string;
}) {
  const [key, setKey] = useState(defaultKey);
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setError("File must be under 25 MB.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await action(fd);
      if (res.ok) {
        setKey(res.key);
        setName(res.name);
      } else {
        setError(res.error);
      }
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <input type="hidden" name={keyName} value={key} />
      <input type="hidden" name={nameName} value={name} />
      <div className="flex flex-wrap items-center gap-2">
        {key ? (
          <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-700">
            <FileDown size={14} className="shrink-0 text-brand-strong" />
            <span className="truncate">{name || "file"}</span>
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
        >
          <Upload size={14} />
          {busy ? "Uploading…" : key ? "Replace file" : "Upload file"}
        </button>
        {key ? (
          <button
            type="button"
            onClick={() => {
              setKey("");
              setName("");
            }}
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-red-700"
          >
            <X size={14} /> Remove
          </button>
        ) : null}
        <input ref={fileRef} type="file" onChange={onPick} className="hidden" />
      </div>
      {recommend ? <p className={cn("mt-1 text-xs text-muted")}>{recommend}</p> : null}
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
