"use client";

import { useEffect } from "react";

/**
 * Captures a `?ref=CODE` param from the landing URL into the `invox_ref` cookie
 * (last-touch, 30 days), so the checkout server action can attribute the order to
 * the affiliate that drove it. Also fires a one-shot click beacon to /api/aff so
 * the seller sees landing counts. Only writes when a ref is present, so a direct
 * visit doesn't clear an earlier attribution. The code is re-validated
 * server-side at checkout, so the cookie can't fabricate a payout.
 */
export function AffiliateCapture() {
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("ref");
    if (!raw) return;
    const code = raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
    if (!code) return;
    document.cookie = `invox_ref=${encodeURIComponent(code)}; path=/; max-age=${
      60 * 60 * 24 * 30
    }; SameSite=Lax`;
    // Fire-and-forget landing counter; failures are non-fatal.
    void fetch("/api/aff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      keepalive: true,
    }).catch(() => {});
  }, []);
  return null;
}
