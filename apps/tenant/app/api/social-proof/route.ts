import { NextResponse, type NextRequest } from "next/server";
import { getTenantTracking, listRecentSocialProof } from "@invoxai/db";
import { resolveTenantByHost } from "../../../lib/resolve";

export const dynamic = "force-dynamic";

/**
 * Growth G1.5 — feed for the public social-proof popups. Anonymous GET from the
 * tenant's public pages; resolves the tenant from the Host header and returns recent
 * MASKED purchases (no PII — see listRecentSocialProof). Honours the seller's toggle:
 * if they switched it off, returns an empty list. Always 200 with a (possibly empty)
 * array — the widget must never surface an error to a visitor.
 */
export async function GET(req: NextRequest) {
  try {
    const tenant = await resolveTenantByHost(req.headers.get("host"));
    if (!tenant || tenant.suspendedAt) {
      return NextResponse.json({ events: [] });
    }
    const tracking = await getTenantTracking(tenant.id);
    // A tracking row with the toggle off disables it; absence = default on.
    if (tracking && !tracking.socialProofEnabled) {
      return NextResponse.json({ events: [] });
    }
    const events = await listRecentSocialProof(tenant.id, { limit: 8, windowDays: 14 });
    return NextResponse.json(
      { events },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch {
    return NextResponse.json({ events: [] });
  }
}
