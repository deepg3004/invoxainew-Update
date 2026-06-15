"use client";

import { useEffect, useState } from "react";

/**
 * Live countdown to an ISO `until` instant, themed by the page tokens. Pure
 * client display — `until` is a validated ISO string from normalizeToBlocks. When
 * the deadline passes it shows the label + "Ended". Renders a stable initial
 * frame on the server/first paint to avoid hydration mismatch (computes remaining
 * only after mount).
 */
export function Countdown({
  until,
  label,
  accent,
  text,
  muted,
  border,
}: {
  until: string;
  label: string;
  accent: string;
  text: string;
  muted: string;
  border: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const target = new Date(until).getTime();
  const remaining = now === null ? target - target : Math.max(0, target - now);
  const ended = now !== null && remaining <= 0;

  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);
  const cells: [number, string][] = [
    [days, "days"],
    [hours, "hrs"],
    [mins, "min"],
    [secs, "sec"],
  ];

  return (
    <div className="mt-6 rounded-xl p-4" style={{ border: `1px solid ${border}` }}>
      {label ? (
        <div className="text-sm font-medium" style={{ color: muted }}>{label}</div>
      ) : null}
      {ended ? (
        <div className="mt-1 text-lg font-semibold" style={{ color: text }}>Ended</div>
      ) : (
        <div className="mt-2 flex gap-3">
          {cells.map(([v, unit]) => (
            <div key={unit} className="flex flex-col items-center">
              <span className="text-2xl font-bold tabular-nums" style={{ color: accent }}>
                {String(v).padStart(2, "0")}
              </span>
              <span className="text-[11px] uppercase tracking-wide" style={{ color: muted }}>{unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
