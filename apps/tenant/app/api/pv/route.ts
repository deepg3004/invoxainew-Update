import { NextResponse, type NextRequest } from "next/server";
import { recordPageView } from "@invoxai/db";
import { resolveTenantByHost } from "../../../lib/resolve";

export const dynamic = "force-dynamic";

/**
 * Page-view beacon sink. Anonymous POST from the public tenant pages. Resolves
 * the tenant from the Host header (so a view can only ever attribute to the site
 * it was viewed on), records a minimal, PII-free event, and always returns 204 —
 * analytics must never surface an error to the visitor. Private/app paths are
 * dropped so only public traffic is counted.
 */
export async function POST(req: NextRequest) {
  try {
    const tenant = await resolveTenantByHost(req.headers.get("host"));
    if (!tenant) return new NextResponse(null, { status: 204 });

    const body = (await req.json().catch(() => null)) as
      | { path?: unknown; sid?: unknown; source?: unknown }
      | null;
    const path = typeof body?.path === "string" ? body.path.slice(0, 512) : "";
    if (!path || !path.startsWith("/")) return new NextResponse(null, { status: 204 });
    if (path.startsWith("/account") || path.startsWith("/api")) {
      return new NextResponse(null, { status: 204 });
    }

    const sessionId = typeof body?.sid === "string" ? body.sid.slice(0, 64) : null;
    const source = typeof body?.source === "string" ? body.source.slice(0, 120) : null;
    const referrer = (req.headers.get("referer") ?? "").slice(0, 512) || null;

    await recordPageView({ tenantId: tenant.id, path, sessionId, source, referrer });
  } catch {
    // swallow — best-effort
  }
  return new NextResponse(null, { status: 204 });
}
