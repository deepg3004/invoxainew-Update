import { NextResponse, type NextRequest } from "next/server";
import { incrementAffiliateClick } from "@invoxai/db";
import { resolveTenantByHost } from "../../../lib/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Affiliate landing-click beacon. Resolves the tenant from the request host (the
 * storefront the buyer is on) and increments the affiliate's click counter.
 * incrementAffiliateClick is a no-op for an unknown/inactive code, so a forged
 * ?ref can neither create rows nor error. Always returns 204 — it's a beacon.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const code = typeof body?.code === "string" ? body.code : "";
    if (code) {
      const tenant = await resolveTenantByHost(request.headers.get("host"));
      if (tenant) await incrementAffiliateClick(tenant.id, code);
    }
  } catch {
    // Beacon — never surface errors to the storefront.
  }
  return new NextResponse(null, { status: 204 });
}
