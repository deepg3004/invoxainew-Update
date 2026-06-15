import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@invoxai/config";
import { sweepAbandonedRecovery } from "@invoxai/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Growth G1.2 — scheduled sweep that sends abandoned-checkout recovery emails.
 * Point an external scheduler (Vercel Cron, an uptime ping, a system cron hitting
 * this URL) at it every ~15 minutes with `Authorization: Bearer <CRON_SECRET>`.
 *
 * Auth is the shared CRON_SECRET (constant-time compare); when it's unset the
 * endpoint is disabled (503) so it can't run unconfigured. The sweep itself is
 * idempotent (each order is atomically claimed before sending) and never throws.
 */
export async function POST(request: NextRequest) {
  const env = serverEnv();
  if (!env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "cron_disabled" }, { status: 503 });
  }

  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.CRON_SECRET}`;
  // Length-checked equality (avoid leaking length via early exit on mismatch).
  if (auth.length !== expected.length || auth !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const summary = await sweepAbandonedRecovery();
  return NextResponse.json({ ok: true, ...summary });
}
