"use client";

import { useEffect } from "react";

/**
 * Captures a `?coupon=CODE` param from the landing URL into the `invox_coupon`
 * cookie (7 days), so a seller can share a discount link (e.g.
 * store.invoxai.io/store?coupon=DIWALI20) and the buy boxes auto-apply it at
 * checkout. Sanitised to the coupon charset; the discount is still re-validated
 * server-side at checkout, so the cookie can't change what's actually charged.
 */
export function CouponCapture() {
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("coupon");
    if (!raw) return;
    const code = raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
    if (!code) return;
    document.cookie = `invox_coupon=${encodeURIComponent(code)}; path=/; max-age=${
      60 * 60 * 24 * 7
    }; SameSite=Lax`;
  }, []);
  return null;
}
