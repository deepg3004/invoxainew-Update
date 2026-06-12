"use client";

import { useEffect } from "react";

const KEYS = ["source", "medium", "campaign", "content", "term"] as const;

/**
 * Captures utm_* params from the landing URL into the `invox_utm` cookie
 * (last-touch, 30 days), so the checkout server action can stamp the order with
 * the campaign that drove it. Only writes when a utm param is present, so a
 * direct visit doesn't clear an earlier attribution. Runs on every public page.
 */
export function UtmCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const k of KEYS) {
      const v = params.get(`utm_${k}`);
      if (v) utm[k] = v.slice(0, 120);
    }
    if (Object.keys(utm).length === 0) return;
    const value = encodeURIComponent(JSON.stringify(utm));
    document.cookie = `invox_utm=${value}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  }, []);
  return null;
}
