"use client";

import { useState } from "react";

/** Copies a shareable store link with the coupon pre-applied (?coupon=CODE). */
export function CopyCouponLink({ url }: { url: string }) {
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
      className="text-muted underline hover:text-zinc-900"
      title={url}
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}
