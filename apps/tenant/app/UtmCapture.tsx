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
    if (Object.keys(utm).length > 0) {
      const value = encodeURIComponent(JSON.stringify(utm));
      document.cookie = `invox_utm=${value}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    }

    // Ad-click attribution: capture fbclid/gclid/ttclid from the query AND the hash
    // (some ad URLs put them after #), plus the Meta pixel's _fbp cookie. Stored in
    // invox_click for the checkout to stamp on the order (Meta CAPI / Google).
    const all = new URLSearchParams(
      window.location.search.slice(1) + "&" + window.location.hash.slice(1),
    );
    const click: Record<string, string> = {};
    for (const k of ["fbclid", "gclid", "ttclid"]) {
      const v = all.get(k);
      if (v) click[k] = v.slice(0, 255);
    }
    const fbp = document.cookie.match(/(?:^|;\s*)_fbp=([^;]+)/)?.[1];
    if (fbp) click.fbp = fbp.slice(0, 255);
    if (Object.keys(click).length > 0) {
      let prev: Record<string, string> = {};
      try {
        const raw = document.cookie.match(/(?:^|;\s*)invox_click=([^;]+)/)?.[1];
        if (raw) prev = JSON.parse(decodeURIComponent(raw)) as Record<string, string>;
      } catch {
        prev = {};
      }
      const value = encodeURIComponent(JSON.stringify({ ...prev, ...click }));
      document.cookie = `invox_click=${value}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    }
  }, []);
  return null;
}
