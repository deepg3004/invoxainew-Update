"use client";

import { useEffect, useState } from "react";

/** Small stable hash so a NEW announcement re-shows even after a prior dismissal. */
function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

/**
 * Storefront announcement bar (seller-set). Dismissible per message: dismissing
 * stores the message's hash in localStorage, so editing the announcement makes a
 * fresh bar appear. Renders server-side (no flash); only hides post-hydration if
 * this exact message was already dismissed (initial state matches SSR → no
 * hydration mismatch). `href` is pre-sanitized server-side.
 */
export function AnnouncementBar({ text, href }: { text: string; href?: string | null }) {
  const [show, setShow] = useState(true);
  const key = `invox_ann_${hash(text)}`;

  useEffect(() => {
    try {
      if (localStorage.getItem(key) === "1") setShow(false);
    } catch {
      /* ignore */
    }
  }, [key]);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <div className="relative bg-brand-gradient px-9 py-2 text-center text-sm font-medium text-white">
      {href ? (
        <a href={href} className="underline-offset-2 hover:underline">
          {text}
        </a>
      ) : (
        <span>{text}</span>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="absolute right-2 top-1/2 -translate-y-1/2 px-2 text-lg leading-none text-white/80 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}
