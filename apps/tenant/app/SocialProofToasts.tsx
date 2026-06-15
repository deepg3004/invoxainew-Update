"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Event = { name: string; item: string; at: string };

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/**
 * Growth G1.5 — floating "someone just bought …" social-proof popups for the public
 * tenant pages. Self-contained: fetches the masked feed once, then rotates through it
 * with a brief show/hide cadence. Renders nothing when the feed is empty or disabled,
 * and stays OFF the buyer's own account area. All data is server-masked (no PII).
 */
export function SocialProofToasts() {
  const pathname = usePathname();
  const [events, setEvents] = useState<Event[]>([]);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(false);

  const offArea = pathname.startsWith("/account") || pathname.startsWith("/pay");

  useEffect(() => {
    if (offArea) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/social-proof");
        if (!res.ok) return;
        const data = (await res.json()) as { events?: Event[] };
        if (!cancelled && Array.isArray(data.events)) setEvents(data.events);
      } catch {
        // best-effort — show nothing on failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [offArea]);

  useEffect(() => {
    if (events.length === 0 || offArea) return;
    // First popup after a short delay, then rotate: ~5s visible, ~8s gap.
    let mounted = true;
    const show = () => mounted && setVisible(true);
    const hide = () => {
      if (!mounted) return;
      setVisible(false);
      setIdx((i) => (i + 1) % events.length);
    };
    const t0 = setTimeout(show, 3000);
    const interval = setInterval(() => {
      show();
      setTimeout(hide, 5000);
    }, 13000);
    const tHide = setTimeout(hide, 8000);
    return () => {
      mounted = false;
      clearTimeout(t0);
      clearTimeout(tHide);
      clearInterval(interval);
    };
  }, [events, offArea]);

  if (offArea || events.length === 0) return null;
  const e = events[idx];
  if (!e) return null;

  return (
    <div
      aria-live="polite"
      className={`fixed bottom-4 left-4 z-50 max-w-xs transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
          🛍️
        </span>
        <div className="min-w-0 text-sm">
          <div className="truncate text-zinc-900">
            <span className="font-semibold">{e.name}</span> bought{" "}
            <span className="font-medium">{e.item}</span>
          </div>
          <div className="text-xs text-muted">{timeAgo(e.at)} · verified purchase</div>
        </div>
      </div>
    </div>
  );
}
