import type { NextRequest } from "next/server";

/**
 * The externally-visible origin of this request (e.g. https://admin.invoxai.io).
 *
 * Behind a reverse proxy, a Node route handler's `new URL(request.url).origin`
 * resolves to the internal bind address (http://localhost:3002), which is wrong
 * for redirects sent to the browser. Caddy forwards the real values in
 * X-Forwarded-Host / X-Forwarded-Proto, so we use those, falling back to the
 * Host header and finally the raw request URL.
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
