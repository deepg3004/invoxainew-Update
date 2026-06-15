"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download, Trash2 } from "lucide-react";
import { formatBytes } from "@invoxai/utils/bytes";
import { formatDateIST } from "@invoxai/utils/date";
import { uploadMediaAction, deleteMediaAction, mediaDownloadUrlAction } from "./actions";

export interface MediaAsset {
  id: string;
  name: string;
  sizeBytes: number;
  contentType: string;
  createdAt: string;
}

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function MediaManager({ assets }: { assets: MediaAsset[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError("File must be under 25 MB.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadMediaAction(fd);
      if (res.ok) router.refresh();
      else setError(res.error);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onDownload(id: string) {
    setPendingId(id);
    try {
      const res = await mediaDownloadUrlAction(id);
      if (res.ok) window.open(res.url, "_blank", "noopener,noreferrer");
      else setError("Couldn’t generate a download link.");
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this file? This can’t be undone.")) return;
    setPendingId(id);
    try {
      await deleteMediaAction(id);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          <Upload size={15} />
          {busy ? "Uploading…" : "Upload file"}
        </button>
        <span className="text-xs text-muted">Any file type, up to 25 MB.</span>
        <input ref={fileRef} type="file" onChange={onPick} className="hidden" />
      </div>
      {error ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {assets.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No files yet. Upload your first above.</p>
      ) : (
        <ul className="mt-5 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-surface">
          {assets.map((a) => (
            <li key={a.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900">{a.name}</span>
                <span className="block text-xs text-muted">
                  {formatBytes(a.sizeBytes)} · {a.contentType} · {formatDateIST(new Date(a.createdAt))}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onDownload(a.id)}
                disabled={pendingId === a.id}
                className="rounded p-1.5 text-muted hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40"
                aria-label="Download"
                title="Download"
              >
                <Download size={16} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(a.id)}
                disabled={pendingId === a.id}
                className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                aria-label="Delete"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
