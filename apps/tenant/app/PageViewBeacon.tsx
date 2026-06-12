"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function sessionId(): string {
  const m = document.cookie.match(/(?:^|; )invox_sid=([^;]+)/);
  if (m) return decodeURIComponent(m[1]!);
  const sid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  document.cookie = `invox_sid=${sid}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  return sid;
}

/**
 * Records a public page view on each navigation via a best-effort beacon to
 * /api/pv (the tenant is resolved server-side from the Host). Skips the buyer
 * area and API routes. Drives the seller's page-level traffic analytics. Sends
 * the utm_source on the landing hit so views can be attributed to a campaign.
 */
export function PageViewBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith("/account") || pathname.startsWith("/api")) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const source = params.get("utm_source")?.slice(0, 120) || undefined;
      // The REAL external referrer (the site that linked here) — not our own
      // pages. document.referrer is empty on direct visits; same-host referrers
      // (internal navigation) are dropped so only external sources are counted.
      let ref: string | undefined;
      try {
        const r = document.referrer;
        if (r && new URL(r).host !== window.location.host) ref = r.slice(0, 512);
      } catch {
        // ignore malformed referrer
      }
      void fetch("/api/pv", {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: pathname, sid: sessionId(), source, ref }),
      }).catch(() => {});
    } catch {
      // ignore
    }
  }, [pathname]);
  return null;
}
