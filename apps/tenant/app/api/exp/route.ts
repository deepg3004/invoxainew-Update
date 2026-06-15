import { NextResponse, type NextRequest } from "next/server";
import { incrementExperiment } from "@invoxai/db";
import { resolveTenantByHost } from "../../../lib/resolve";

export const dynamic = "force-dynamic";

/**
 * Growth G1.6 — A/B counter beacon. Anonymous POST from the public tenant pages:
 * { id, variant: "A"|"B", kind: "view"|"conversion" }. Resolves the tenant from the
 * Host header (a beacon can only ever count on the site it fired from) and bumps the
 * RUNNING experiment's counter. Advisory data (like page-views), so it always returns
 * 204 and never blocks the visitor. Best-effort; unknown/stopped experiments no-op.
 */
export async function POST(req: NextRequest) {
  try {
    const tenant = await resolveTenantByHost(req.headers.get("host"));
    if (!tenant) return new NextResponse(null, { status: 204 });

    const body = (await req.json().catch(() => null)) as
      | { id?: unknown; variant?: unknown; kind?: unknown }
      | null;
    const id = typeof body?.id === "string" ? body.id : "";
    const variant = body?.variant === "A" || body?.variant === "B" ? body.variant : null;
    const kind = body?.kind === "view" || body?.kind === "conversion" ? body.kind : null;
    if (!id || !variant || !kind) return new NextResponse(null, { status: 204 });

    await incrementExperiment(id, variant, kind);
  } catch {
    // swallow — advisory best-effort
  }
  return new NextResponse(null, { status: 204 });
}
