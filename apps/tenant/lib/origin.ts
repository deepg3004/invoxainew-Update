import type { NextRequest } from "next/server";

/**
 * The externally-visible origin of this request (e.g. https://dmk.invoxai.io).
 * Behind Caddy, a Node handler's request URL is the internal bind address, so we
 * trust the forwarded host/proto headers. Per-tenant — the host is the seller's
 * own subdomain, which is exactly where buyer auth must redirect back to.
 */
export function requestOrigin(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ??
    new URL(request.url).protocol.replace(":", "");
  if (host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}
