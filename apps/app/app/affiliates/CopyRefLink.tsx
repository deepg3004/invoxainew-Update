"use client";

import { useState } from "react";

/** Copies a shareable affiliate link (?ref=CODE). Mirrors CopyCouponLink. */
export function CopyRefLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard?.writeText(url).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => {},
        )
      }
      className="text-brand-strong underline hover:text-zinc-900"
      title={url}
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}
