"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const KEYS = ["source", "medium", "campaign", "content", "term"] as const;

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
      let source: string | undefined;
      const params = new URLSearchParams(window.location.search);
      for (const k of KEYS) {
        if (k === "source" && params.get("utm_source")) source = params.get("utm_source")!.slice(0, 120);
      }
      void fetch("/api/pv", {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: pathname, sid: sessionId(), source }),
      }).catch(() => {});
    } catch {
      // ignore
    }
  }, [pathname]);
  return null;
}
