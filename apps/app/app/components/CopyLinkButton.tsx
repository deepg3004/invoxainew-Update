"use client";

import { useState } from "react";

/** Copies a public URL to the clipboard with brief "Copied!" feedback. Used on
 *  the seller's content lists so sharing a sale link is one click. */
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / permissions) — no-op.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="text-muted underline hover:text-white"
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}
