/**
 * Read the share-link coupon code captured by <CouponCapture> from the cookie
 * (client-side). Returns "" when none. The buy boxes use this to pre-apply a
 * shared discount; the server re-validates at checkout regardless.
 */
export function readCouponCookie(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|; )invox_coupon=([^;]+)/);
  return m && m[1] ? decodeURIComponent(m[1]) : "";
}
